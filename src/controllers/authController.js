const User = require('../models/User');
const Admin = require('../models/Admin');
const { generateTokens } = require('../middleware/auth');
const { generateAdminTokens } = require('../middleware/adminAuth');
const { sendOtpSms } = require('../services/sms');
const { getRedis } = require('../config/redis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// In-memory OTP store fallback when Redis is unavailable
const otpMemStore = new Map();

const storeOtp = async (mobile, otp) => {
  const redis = getRedis();
  if (redis) {
    await redis.setEx(`otp:${mobile}`, 300, String(otp)); // 5 min TTL
  } else {
    otpMemStore.set(`otp:${mobile}`, { otp: String(otp), expiresAt: Date.now() + 5 * 60 * 1000 });
  }
};

const retrieveOtp = async (mobile) => {
  const redis = getRedis();
  if (redis) {
    return redis.get(`otp:${mobile}`);
  }
  const entry = otpMemStore.get(`otp:${mobile}`);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    otpMemStore.delete(`otp:${mobile}`);
    return null;
  }
  return entry.otp;
};

const deleteOtp = async (mobile) => {
  const redis = getRedis();
  if (redis) {
    await redis.del(`otp:${mobile}`);
  } else {
    otpMemStore.delete(`otp:${mobile}`);
  }
};

// POST /api/auth/send-otp
const sendOtp = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await storeOtp(mobile, otp);
    const smsResult = await sendOtpSms(mobile, otp);
    // Always log OTP so admin can verify if SMS delivery fails
    console.log(`\n========== OTP ==========\nMobile : ${mobile}\nOTP    : ${otp}\nSMS    : ${smsResult.success ? 'Sent ✓' : 'FAILED — ' + smsResult.error}\n=========================\n`);

    return res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    console.error('sendOtp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp, name } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP are required' });
    }

    const storedOtp = await retrieveOtp(mobile);
    if (!storedOtp || storedOtp !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    await deleteOtp(mobile);

    let user = await User.findOne({ mobile });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        mobile,
        name: name || `User ${mobile.slice(-4)}`,
        isVerified: true,
      });
    } else {
      user.isVerified = true;
      user.lastLogin = new Date();
    }

    const { token, refreshToken } = generateTokens(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    return res.json({
      success: true,
      token,
      refreshToken,
      isNewUser,
      user: {
        _id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        kycStatus: user.kycStatus,
        profilePic: user.profilePic,
      },
    });
  } catch (error) {
    console.error('verifyOtp error:', error);
    return res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

// POST /api/auth/admin-login  — uses separate Admin collection
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');
    if (!admin || !admin.password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is disabled' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const { token, refreshToken: rToken } = generateAdminTokens(admin._id);
    admin.refreshToken = rToken;
    admin.lastLogin = new Date();
    await admin.save();

    return res.json({
      success: true,
      token,
      refreshToken: rToken,
      user: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      },
    });
  } catch (error) {
    console.error('adminLogin error:', error);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// POST /api/auth/refresh-token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }
    if (user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account is blocked' });
    }

    const { token: newToken, refreshToken: newRefreshToken } = generateTokens(user._id);
    user.refreshToken = newRefreshToken;
    await user.save();

    return res.json({ success: true, token: newToken, refreshToken: newRefreshToken });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};

// POST /api/auth/logout
const logout = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await User.findOneAndUpdate({ refreshToken: token }, { refreshToken: null });
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Logout failed' });
  }
};

// GET /api/auth/google/callback
const googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const { token, refreshToken: rToken } = generateTokens(user._id);
    user.refreshToken = rToken;
    await user.save();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(
      `${frontendUrl}/auth/google/success?token=${token}&refreshToken=${rToken}`
    );
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/auth/google/error`);
  }
};

module.exports = { sendOtp, verifyOtp, adminLogin, refreshToken, logout, googleCallback };

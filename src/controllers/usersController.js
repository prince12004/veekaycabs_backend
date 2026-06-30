const User = require('../models/User');
const UserDocument = require('../models/UserDocument');
const { getFileUrl } = require('../middleware/upload');
const { getRedis } = require('../config/redis');

// GET /api/users/profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-refreshToken');
    const docs = await UserDocument.findOne({ userId: req.user._id });

    return res.json({
      success: true,
      data: {
        user,
        documents: docs
          ? {
              aadhaarStatus: docs.aadhaar?.status || 'not_uploaded',
              panStatus: docs.pan?.status || 'not_uploaded',
              dlStatus: docs.dl?.status || 'not_uploaded',
            }
          : null,
      },
    });
  } catch (error) {
    console.error('getProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { name, email, address, mobile } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (address !== undefined) updates.address = address.trim();
    if (mobile !== undefined) {
      const cleaned = mobile.replace(/\D/g, '');
      if (!/^\d{10}$/.test(cleaned)) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
      }
      // Only allow update if current mobile is a Google placeholder
      if (!String(req.user.mobile).startsWith('google_')) {
        return res.status(400).json({ success: false, message: 'Mobile number cannot be changed once set' });
      }
      updates.mobile = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    }).select('-refreshToken');

    return res.json({ success: true, data: user });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }
    console.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// POST /api/users/upload-photo
const uploadProfilePhoto = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const fileUrl = getFileUrl(file);
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePic: fileUrl },
      { new: true }
    ).select('-refreshToken');

    return res.json({ success: true, data: { profilePic: fileUrl, user } });
  } catch (error) {
    console.error('uploadProfilePhoto error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload photo' });
  }
};

// POST /api/users/add-mobile  — verify OTP then attach mobile to Google account
const addMobile = async (req, res) => {
  try {
    const { mobile, otp } = req.body;
    if (!mobile || !otp) {
      return res.status(400).json({ success: false, message: 'Mobile and OTP are required' });
    }

    const cleaned = mobile.replace(/\D/g, '');
    if (!/^\d{10}$/.test(cleaned)) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
    }

    if (!String(req.user.mobile).startsWith('google_')) {
      return res.status(400).json({ success: false, message: 'Mobile already set' });
    }

    // Verify OTP from Redis (same store as authController uses)
    let storedOtp = null;
    const redis = getRedis();
    if (redis) {
      storedOtp = await redis.get(`otp:${cleaned}`);
    }
    if (!storedOtp || String(storedOtp) !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }
    if (redis) await redis.del(`otp:${cleaned}`);

    // Check mobile not taken by another user
    const existing = await User.findOne({ mobile: cleaned });
    if (existing && existing._id.toString() !== req.user._id.toString()) {
      return res.status(409).json({ success: false, message: 'This mobile is already registered with another account' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { mobile: cleaned },
      { new: true, runValidators: true }
    ).select('-refreshToken');

    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('addMobile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add mobile' });
  }
};

module.exports = { getProfile, updateProfile, uploadProfilePhoto, addMobile };

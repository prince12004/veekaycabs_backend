const User = require('../../models/User');
const UserDocument = require('../../models/UserDocument');
const Booking = require('../../models/Booking');

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { kycStatus, isBlocked, search, page = 1, limit = 20 } = req.query;
    const filter = { role: 'user' };

    if (kycStatus) filter.kycStatus = kycStatus;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-refreshToken')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.json({
      success: true,
      data: users,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('admin getAllUsers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

// GET /api/admin/users/:id
const getUserDetail = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-refreshToken');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const docs = await UserDocument.findOne({ userId: user._id });
    const bookings = await Booking.find({ userId: user._id })
      .populate('carId', 'name registrationNo')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.json({ success: true, data: { user, documents: docs, recentBookings: bookings } });
  } catch (error) {
    console.error('admin getUserDetail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// PATCH /api/admin/users/:id/block
const toggleBlockUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot block admin accounts' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.json({
      success: true,
      data: { _id: user._id, isBlocked: user.isBlocked },
      message: `User ${user.isBlocked ? 'blocked' : 'unblocked'} successfully`,
    });
  } catch (error) {
    console.error('admin toggleBlockUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle block status' });
  }
};

// PUT /api/admin/users/:id — admin edits user details
const updateUser = async (req, res) => {
  try {
    const { name, email, mobile, address } = req.body;
    const updates = {};
    if (name  !== undefined) updates.name    = String(name).trim();
    if (email !== undefined) updates.email   = String(email).toLowerCase().trim();
    if (address !== undefined) updates.address = String(address).trim();
    if (mobile !== undefined) {
      const cleaned = String(mobile).replace(/\D/g, '');
      if (!/^\d{10}$/.test(cleaned)) {
        return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number' });
      }
      updates.mobile = cleaned;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, {
      new: true, runValidators: true,
    }).select('-refreshToken');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, data: user, message: 'User updated successfully' });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {})[0] || 'field';
      return res.status(400).json({ success: false, message: `${field} already in use` });
    }
    console.error('admin updateUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user' });
  }
};

module.exports = { getAllUsers, getUserDetail, toggleBlockUser, updateUser };

const User = require('../../models/User');
const UserDocument = require('../../models/UserDocument');
const Booking = require('../../models/Booking');

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const { kycStatus, isBlocked, search, page = 1, limit = 20 } = req.query;
    const filter = { role: 'user', isDeleted: { $ne: true } };

    if (kycStatus) filter.kycStatus = kycStatus;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select('-refreshToken')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

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

    const [docs, bookings] = await Promise.all([
      UserDocument.findOne({ userId: user._id }),
      Booking.find({ userId: user._id, isDeleted: { $ne: true } })
        .populate('carId', 'name registrationNo')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    return res.json({ success: true, data: { user, documents: docs, recentBookings: bookings } });
  } catch (error) {
    console.error('admin getUserDetail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

// PATCH /api/admin/users/:id/block
const toggleBlockUser = async (req, res) => {
  try {
    // role check folded into the update pipeline so admin accounts are left untouched
    // in the same round trip instead of a separate read-then-write
    const user = await User.findByIdAndUpdate(
      req.params.id,
      [{ $set: { isBlocked: { $cond: [{ $eq: ['$role', 'admin'] }, '$isBlocked', { $not: '$isBlocked' }] } } }],
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot block admin accounts' });
    }

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

// DELETE /api/admin/users/:id — soft delete: hides from admin lists, blocks
// login, never wipes the account or its booking/KYC history
const deleteUser = async (req, res) => {
  try {
    const existing = await User.findById(req.params.id, 'role');
    if (!existing) return res.status(404).json({ success: false, message: 'User not found' });
    if (existing.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete admin accounts' });
    }
    await User.findByIdAndUpdate(req.params.id, { isDeleted: true, isBlocked: true });
    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('admin deleteUser error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
};

// GET /api/admin/users/export
const exportUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user', isDeleted: { $ne: true } })
      .select('-refreshToken')
      .sort({ createdAt: -1 })
      .limit(10000);

    const headers = ['Name', 'Mobile', 'Email', 'KYC Status', 'Blocked', 'Total Bookings', 'Joined At'];

    const rows = users.map((u) => [
      u.name || '',
      u.mobile || '',
      u.email || '',
      u.kycStatus,
      u.isBlocked ? 'Yes' : 'No',
      u.totalBookings || 0,
      new Date(u.createdAt).toLocaleString('en-IN'),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('admin exportUsers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export users' });
  }
};

module.exports = { getAllUsers, getUserDetail, toggleBlockUser, updateUser, deleteUser, exportUsers };

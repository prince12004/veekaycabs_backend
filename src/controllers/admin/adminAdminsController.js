const bcrypt = require('bcryptjs');
const Admin = require('../../models/Admin');

// GET /api/admin/admins
const getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find()
      .select('-refreshToken -password')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: admins });
  } catch (error) {
    console.error('getAllAdmins error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch admins' });
  }
};

// POST /api/admin/admins
const createAdmin = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const existing = await Admin.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An admin with this email already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      role: role || 'admin',
      permissions: permissions || undefined,
    });

    return res.status(201).json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error('createAdmin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
};

// PUT /api/admin/admins/:id
const updateAdmin = async (req, res) => {
  try {
    const { name, email, password, role, permissions } = req.body;
    const admin = await Admin.findById(req.params.id).select('+password');
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    if (name) admin.name = name;
    if (email) admin.email = email.toLowerCase();
    if (role) admin.role = role;
    if (permissions) admin.permissions = { ...admin.permissions, ...permissions };
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      }
      admin.password = await bcrypt.hash(password, 10);
    }
    await admin.save();

    return res.json({
      success: true,
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error('updateAdmin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update admin' });
  }
};

// DELETE /api/admin/admins/:id
const deleteAdmin = async (req, res) => {
  try {
    if (req.params.id === String(req.admin._id)) {
      return res.status(400).json({ success: false, message: "You can't delete your own account" });
    }

    const totalAdmins = await Admin.countDocuments();
    if (totalAdmins <= 1) {
      return res.status(400).json({ success: false, message: 'Cannot delete the last admin account' });
    }

    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) return res.status(404).json({ success: false, message: 'Admin not found' });

    return res.json({ success: true, message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('deleteAdmin error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete admin' });
  }
};

module.exports = { getAllAdmins, createAdmin, updateAdmin, deleteAdmin };

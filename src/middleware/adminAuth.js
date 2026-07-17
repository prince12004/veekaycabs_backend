const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Generates admin-specific tokens (payload includes type:'admin' to differentiate from user tokens)
const generateAdminTokens = (adminId) => {
  const token = jwt.sign(
    { id: adminId, type: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
  const refreshToken = jwt.sign(
    { id: adminId, type: 'admin' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  return { token, refreshToken };
};

// Middleware: verify JWT and load admin from Admin collection (not User)
const protectAdmin = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // New tokens carry type:'admin'. Old tokens have no type — allow if the id
    // resolves to an Admin document (legacy sessions stay alive without re-login).
    // Explicitly non-admin type strings are always rejected.
    if (decoded.type && decoded.type !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const admin = await Admin.findById(decoded.id).select('-refreshToken');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account not found' });
    }
    if (!admin.isActive) {
      return res.status(403).json({ success: false, message: 'Admin account is disabled' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

// Middleware: only super_admin can proceed
const superAdminOnly = (req, res, next) => {
  if (req.admin?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  }
  next();
};

// Middleware factory: super_admin always passes; any other admin needs the
// matching "<section>_<op>" flag explicitly granted via Manage Admins
// (e.g. requirePermission('fleet', 'delete') needs permissions.fleet_delete).
const requirePermission = (section, op) => (req, res, next) => {
  if (req.admin?.role === 'super_admin') return next();
  if (req.admin?.permissions?.[`${section}_${op}`] === true) return next();
  return res.status(403).json({ success: false, message: `You don't have permission to ${op} ${section}` });
};

module.exports = { protectAdmin, superAdminOnly, requirePermission, generateAdminTokens };

const User = require('../models/User');
const UserDocument = require('../models/UserDocument');

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
    const { name, email, address } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (address !== undefined) updates.address = address.trim();

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

    const fileUrl = file.location || `/uploads/${file.filename}`;
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

module.exports = { getProfile, updateProfile, uploadProfilePhoto };

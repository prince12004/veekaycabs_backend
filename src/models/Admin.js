const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },

    role: {
      type: String,
      enum: ['super_admin', 'admin', 'tempo_admin', 'sub_admin', 'custom'],
      default: 'admin',
    },

    // Flat map of section + section_op keys (e.g. "fleet", "fleet_delete",
    // "content_delete") set by the Manage Admins UI. Mixed (not a fixed
    // sub-schema) so every granular op the UI sends actually persists —
    // a strict sub-schema here previously silently dropped anything beyond
    // the 8 section-level booleans.
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },

    isActive:     { type: Boolean, default: true },
    refreshToken: { type: String, select: false },
    lastLogin:    { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', AdminSchema);

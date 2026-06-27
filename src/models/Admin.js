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

    permissions: {
      dashboard:  { type: Boolean, default: true  },
      fleet:      { type: Boolean, default: true  },
      bookings:   { type: Boolean, default: true  },
      users:      { type: Boolean, default: true  },
      finance:    { type: Boolean, default: false },
      settings:   { type: Boolean, default: false },
      tempoAdmin: { type: Boolean, default: false },
      content:    { type: Boolean, default: true  },
    },

    isActive:     { type: Boolean, default: true },
    refreshToken: { type: String, select: false },
    lastLogin:    { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', AdminSchema);

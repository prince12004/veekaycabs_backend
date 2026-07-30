const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, unique: true, trim: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    // Custom (not `match`) so an empty/unset email — the common case for
    // mobile-OTP signups who never added one — doesn't fail validation;
    // only a non-empty, malformed value gets rejected.
    validate: {
      validator: (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Enter a valid email address',
    },
  },
  password: { type: String, select: false },
  address: { type: String, maxlength: [100, 'Address must be 100 characters or less'] },
  profilePic: { type: String },
  googleId: { type: String },
  isVerified: { type: Boolean, default: false },
  isBlocked: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }, // soft-delete — admin "Delete" hides, never wipes real customer/booking history
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  kycStatus: {
    type: String,
    enum: ['not_submitted', 'pending', 'verified', 'rejected'],
    default: 'not_submitted',
  },
  totalBookings: { type: Number, default: 0 },
  refreshToken: { type: String },
  lastLogin: { type: Date },
}, { timestamps: true });

UserSchema.index({ email: 1 });
UserSchema.index({ kycStatus: 1 });          // admin KYC filter
UserSchema.index({ isBlocked: 1 });          // admin blocked-users filter
UserSchema.index({ isDeleted: 1 });          // admin soft-delete filter
UserSchema.index({ createdAt: -1 });         // admin user listing

module.exports = mongoose.model('User', UserSchema);

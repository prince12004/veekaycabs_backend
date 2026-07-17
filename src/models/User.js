const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, unique: true, trim: true },
  email: { type: String, lowercase: true, trim: true },
  password: { type: String, select: false },
  address: { type: String },
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

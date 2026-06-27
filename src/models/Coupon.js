const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  discountValue: { type: Number, required: true },
  maxDiscount: { type: Number },
  minBookingAmount: { type: Number, default: 0 },
  usageLimit: { type: Number, default: 100 },
  usedCount: { type: Number, default: 0 },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  description: { type: String },
  applicableCities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
}, { timestamps: true });

module.exports = mongoose.model('Coupon', CouponSchema);

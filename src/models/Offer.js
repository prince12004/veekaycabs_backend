const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  imageUrl:    { type: String, default: '' },
  couponCode:  { type: String, uppercase: true, trim: true },
  discountPct: { type: Number, default: 0 },    // percentage off
  validUntil:  { type: Date },
  linkUrl:     { type: String, default: '' },
  displayPage: { type: String, enum: ['home', 'booking', 'tempo', 'all'], default: 'home' },
  isActive:    { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 },
}, { timestamps: true });

OfferSchema.index({ isActive: 1, validUntil: 1 });
module.exports = mongoose.model('Offer', OfferSchema);

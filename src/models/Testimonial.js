const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  city:        { type: String, trim: true },
  rating:      { type: Number, min: 1, max: 5, default: 5 },
  review:      { type: String, required: true },
  carBooked:   { type: String, trim: true },      // e.g. "Hyundai Creta"
  avatarUrl:   { type: String, default: '' },
  isActive:    { type: Boolean, default: true },
  showOnHome:  { type: Boolean, default: true },
  sortOrder:   { type: Number, default: 0 },
  source:      { type: String, enum: ['google', 'direct', 'facebook', 'other'], default: 'google' },
}, { timestamps: true });

TestimonialSchema.index({ isActive: 1, showOnHome: 1, sortOrder: 1 });
module.exports = mongoose.model('Testimonial', TestimonialSchema);

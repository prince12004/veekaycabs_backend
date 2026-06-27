const mongoose = require('mongoose');

const SliderSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  subtitle:    { type: String, trim: true },
  imageUrl:    { type: String, required: true },
  linkUrl:     { type: String, default: '' },
  linkText:    { type: String, default: 'Book Now' },
  displayPage: { type: String, enum: ['home', 'tempo', 'both'], default: 'home' },
  sortOrder:   { type: Number, default: 0 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

SliderSchema.index({ isActive: 1, sortOrder: 1 });
module.exports = mongoose.model('Slider', SliderSchema);

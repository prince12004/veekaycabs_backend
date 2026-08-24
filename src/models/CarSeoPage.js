const mongoose = require('mongoose');

const CarSeoPageSchema = new mongoose.Schema({
  pageName: { type: String, required: true, trim: true },
  pageSlug: { type: String, required: true, unique: true },
  metaTitle: { type: String, required: true },
  metaKeywords: { type: String },
  metaDescription: { type: String, required: true },
  h1Tag: { type: String },
  shortContent: { type: String },
  content: { type: String },
  author: { type: String },
  robots: { type: String, default: 'index, follow' },
  parent: { type: String },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }, // soft-delete
}, { timestamps: true });

module.exports = mongoose.model('CarSeoPage', CarSeoPageSchema);

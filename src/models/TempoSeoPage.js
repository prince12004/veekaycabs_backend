const mongoose = require('mongoose');

const TempoSeoPageSchema = new mongoose.Schema({
  pageName: { type: String, required: true, trim: true },
  pageSlug: { type: String, required: true, unique: true },
  metaTitle: { type: String, required: true },
  metaKeywords: { type: String },
  metaDescription: { type: String, required: true },
  h1Tag: { type: String },
  author: { type: String },
  robots: { type: String, default: 'index, follow' },
  sortContent: { type: String },
  content: { type: String },
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }, // soft-delete
}, { timestamps: true });

module.exports = mongoose.model('TempoSeoPage', TempoSeoPageSchema);

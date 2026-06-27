const mongoose = require('mongoose');

const SeoPageSchema = new mongoose.Schema({
  pageName: { type: String, required: true, unique: true },
  pageSlug: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  keywords: [String],
  ogTitle: String,
  ogDescription: String,
  ogImage: String,
  canonicalUrl: String,
  noIndex: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('SeoPage', SeoPageSchema);

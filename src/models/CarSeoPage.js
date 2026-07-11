const mongoose = require('mongoose');

// SEO landing pages for self-drive car rental content (imported from the old
// site's `tbl_pages` MySQL table). Mirrors the shape of TempoSeoPage, which
// is the equivalent for tempo-traveller content.
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
}, { timestamps: true });

module.exports = mongoose.model('CarSeoPage', CarSeoPageSchema);

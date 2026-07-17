const mongoose = require('mongoose');

const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, required: true },
  excerpt: { type: String, required: true },
  content: { type: String, required: true },
  coverImage: { type: String },
  tags: [String],
  author: { type: String, default: 'Veekay Cabs Team' },
  authorPic: { type: String },
  isPublished: { type: Boolean, default: false },
  publishedAt: { type: Date },
  readTime: { type: Number, default: 5 },
  views: { type: Number, default: 0 },
  seoTitle: String,
  seoDescription: String,
  seoKeywords: String,
  isDeleted: { type: Boolean, default: false }, // soft-delete
}, { timestamps: true });

BlogSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', BlogSchema);

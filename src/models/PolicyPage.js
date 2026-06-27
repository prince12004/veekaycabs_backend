const mongoose = require('mongoose');

// Stores editable static pages: about_us, privacy, terms, refund_policy
const PolicyPageSchema = new mongoose.Schema({
  pageKey:    { type: String, required: true, unique: true, enum: ['about', 'privacy', 'terms', 'refund', 'cancellation'] },
  title:      { type: String, required: true },
  content:    { type: String, required: true },  // HTML from rich text editor
  metaTitle:  { type: String },
  metaDesc:   { type: String },
  lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('PolicyPage', PolicyPageSchema);

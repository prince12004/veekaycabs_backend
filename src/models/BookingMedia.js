const mongoose = require('mongoose');

const BookingMediaSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  type: {
    type: String,
    enum: ['pickup_photos', 'return_photos', 'damage_photos'],
    required: true,
  },
  urls: [String],
  uploadedBy: { type: String, enum: ['admin', 'user'] },
  notes: { type: String },
  uploadedAt: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('BookingMedia', BookingMediaSchema);

const mongoose = require('mongoose');

const RefundSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  razorpayPaymentId: { type: String, required: true },
  razorpayRefundId: { type: String },
  amount: { type: Number, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
  processedAt: { type: Date },
  notes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Refund', RefundSchema);

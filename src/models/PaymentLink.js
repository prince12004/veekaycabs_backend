const mongoose = require('mongoose');

const PaymentLinkSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  razorpayLinkId: { type: String },
  amount: { type: Number, required: true },
  purpose: { type: String, required: true },
  link: { type: String },
  status: {
    type: String,
    enum: ['created', 'paid', 'expired', 'cancelled'],
    default: 'created',
  },
  expiresAt: { type: Date },
  paidAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('PaymentLink', PaymentLinkSchema);

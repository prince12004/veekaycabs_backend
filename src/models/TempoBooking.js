const mongoose = require('mongoose');

const TempoBookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tempoId: { type: mongoose.Schema.Types.ObjectId, ref: 'TempoTraveller', required: true },
  tripType: { type: String, enum: ['round_trip', 'local'], required: true },
  pickupCity: { type: String, required: true },
  pickupLocation: { type: String },
  destination: { type: String, required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  passengers: { type: Number, default: 1 },
  baseFare: { type: Number, required: true },
  gst: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  tokenAmount: { type: Number, required: true },
  balanceDue: { type: Number, required: true },
  securityDeposit: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  paymentMode: {
    type: String,
    enum: ['online', 'offline_cash', 'offline_qr'],
    default: 'online',
  },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'pending',
  },
  carReceived: { type: Boolean, default: false },
  isOffline: { type: Boolean, default: false },
  cancellationReason: { type: String },
  cancelledAt: { type: Date },
  refundAmount: { type: Number, default: 0 },
  notes: { type: String },
}, { timestamps: true });

TempoBookingSchema.pre('save', async function (next) {
  if (!this.bookingId) {
    const prefix = 'TT';
    const ts = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.bookingId = `${prefix}${ts}${rand}`;
  }
  next();
});

TempoBookingSchema.index({ userId: 1, status: 1 });
TempoBookingSchema.index({ tempoId: 1, startTime: 1, endTime: 1 });
TempoBookingSchema.index({ status: 1, createdAt: -1 });  // admin listing
TempoBookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('TempoBooking', TempoBookingSchema);

const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  pickupLocation: { type: String, required: true },
  doorstepDelivery: { type: Boolean, default: false },
  deliveryAddress: { type: String },
  doorstepCharge: { type: Number, default: 0 },
  bookingFare: { type: Number, required: true },
  securityDeposit: { type: Number, default: 10000 },
  discount: { type: Number, default: 0 },
  gst: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  tokenAmount: { type: Number, required: true },
  balanceDue: { type: Number, required: true },
  amountPaid: { type: Number, default: 0 },
  paymentMode: {
    type: String,
    enum: ['online', 'offline_cash', 'offline_qr'],
    default: 'online',
  },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  couponCode: { type: String, uppercase: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled'],
    default: 'pending',
  },
  cancellationReason: { type: String },
  cancelledAt: { type: Date },
  refundAmount: { type: Number, default: 0 },
  billUrl: { type: String },
  isOffline: { type: Boolean, default: false },
  odometerStart: { type: Number },
  odometerEnd: { type: Number },
  extraKmCharge: { type: Number, default: 0 },
  challanDetails: { type: String },
  dentDetectionResult: {
    newDamageFound: { type: Boolean },
    damageCount: { type: Number },
    damages: [{
      location: { type: String },
      type: { type: String },
      severity: { type: String },
      description: { type: String },
    }],
    partsChecked: [{
      part: { type: String },
      pickupStatus: { type: String, enum: ['ok', 'minor_mark', 'damaged', 'not_visible'] },
      returnStatus: { type: String, enum: ['ok', 'minor_mark', 'damaged', 'not_visible'] },
      newDamage: { type: Boolean, default: false },
      lowConfidence: { type: Boolean, default: false },
      note: { type: String },
    }],
    summary: { type: String },
    confidenceNote: { type: String },
    analyzedAt: { type: Date },
    model: { type: String },
  },
}, { timestamps: true });

BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ carId: 1, startTime: 1, endTime: 1 });
BookingSchema.index({ status: 1, createdAt: -1 });     // admin listing by status
BookingSchema.index({ createdAt: -1 });                 // admin dashboard recent
BookingSchema.index({ razorpayOrderId: 1 }, { sparse: true }); // payment webhook lookup

module.exports = mongoose.model('Booking', BookingSchema);

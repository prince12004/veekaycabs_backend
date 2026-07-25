const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  pickupLocation: { type: String, required: true },
  bookedBy: { type: String },
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
  pickupReminderSent: { type: Boolean, default: false },
  billUrl: { type: String },
  isOffline: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false }, // soft-delete — admin "Delete" hides from lists, never wipes the record
  odometerStart: { type: Number },
  odometerEnd: { type: Number },
  extraKmCharge: { type: Number, default: 0 },
  challanDetails: { type: String },
  pickupCondition: {
    fuel: { type: Number, min: 0, max: 100 },
    odometer: { type: Number },
    challan: { type: Boolean },
    damage: { type: String },
    extras: { type: String },
    tyres: { type: String },
    ac: { type: Boolean },
    documents: { type: Boolean },
    recordedAt: { type: Date },
  },
  returnCondition: {
    fuel: { type: Number, min: 0, max: 100 },
    odometer: { type: Number },
    challan: { type: Boolean },
    damage: { type: String },
    extras: { type: String },
    tyres: { type: String },
    ac: { type: Boolean },
    documents: { type: Boolean },
    recordedAt: { type: Date },
  },
  // Final return-time settlement — captured when admin closes the booking
  // after the car is returned. Kept embedded (not a separate collection)
  // since it's always read/written together with the booking.
  closingBill: {
    totalKms: { type: Number },
    kmsLimit: { type: Number },
    extraKms: { type: Number },
    extraKmRate: { type: Number },
    // Late return — car came back after the scheduled endTime
    actualReturnTime: { type: Date },
    lateHours: { type: Number, default: 0 },
    lateHourRate: { type: Number, default: 0 },
    lateCharges: { type: Number, default: 0 },
    pickupCharges: { type: Number, default: 0 },
    dropCharges: { type: Number, default: 0 },
    fastagStateTax: { type: Number, default: 0 },
    allStateChallan: { type: Number, default: 0 },
    overspeedingFine: { type: Number, default: 0 },
    fuelCharges: { type: Number, default: 0 },
    damageCharges: { type: Number, default: 0 },
    washingCharges: { type: Number, default: 0 },
    totalCharges: { type: Number },
    advancePaid: { type: Number },
    // positive = customer owes this; negative = refund owed to customer
    settlementAmount: { type: Number },
    notes: { type: String },
    closedAt: { type: Date },
    billPdfUrl: { type: String },
    billSentAt: { type: Date },
    refundPaid: { type: Boolean, default: false },
    refundPaidAt: { type: Date },
  },
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

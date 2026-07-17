const mongoose = require('mongoose');

const TempoTravellerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  registrationNo: { type: String, required: true, unique: true, uppercase: true },
  seats: { type: Number, required: true, enum: [9, 12, 13, 14, 16, 17, 20, 26] },
  fuel: { type: String, enum: ['Petrol', 'Diesel', 'CNG', 'Electric'], default: 'Diesel' },
  location: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  basePrice: { type: Number, required: true },    // per trip base
  pricePerDay: { type: Number, required: true },   // per day rate
  pricePerKm: { type: Number, required: true },    // per km rate
  tollForExtraTrip: { type: Number, default: 0 },
  refundableDeposit: { type: Number, default: 0 },
  homeDeliveryCharge: { type: Number, default: 0 },
  homeDeliveryAvailable: { type: Boolean, default: false },
  shortDescription: { type: String },
  images: [String],
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }, // soft-delete — distinct from isActive, which "Hide" also toggles
  showOnTop: { type: Boolean, default: false },
  slug: { type: String, unique: true },
  features: [String],
}, { timestamps: true });

TempoTravellerSchema.pre('save', function (next) {
  if (this.isModified('name') || this.isModified('registrationNo') || !this.slug) {
    const base = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const suffix = this.registrationNo.slice(-4).toLowerCase();
    this.slug = `${base}-${suffix}`;
  }
  next();
});

TempoTravellerSchema.index({ isActive: 1, seats: 1 });

module.exports = mongoose.model('TempoTraveller', TempoTravellerSchema);

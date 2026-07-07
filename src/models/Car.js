const mongoose = require('mongoose');

const CarSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  registrationNo: { type: String, required: true, unique: true, uppercase: true },
  modelYear: { type: Number, required: true },
  type: { type: String, enum: ['Sedan', 'Hatchback', 'SUV', 'MUV', 'Luxury'], required: true },
  fuel: { type: String, enum: ['Petrol', 'Diesel', 'CNG', 'Electric'], required: true },
  transmission: { type: String, enum: ['Manual', 'Automatic'], required: true },
  seats: { type: Number, required: true },
  regularPrice: { type: Number, required: true },
  weekendPrice: { type: Number, required: true },
  securityDeposit: { type: Number, default: 10000 },
  doorstepDeliveryCharge: { type: Number, default: 500 },
  kmPackage: { type: String, default: '250 km/day' },
  images: [String],
  cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  gpsDeviceId: { type: String },
  isActive: { type: Boolean, default: true },
  slug: { type: String, unique: true },
  features: [String],
  odometer: { type: Number, default: 0 }, // current km reading, updated manually by admin
  maintenance: {
    serviceIntervalKm: { type: Number, default: 5000 },
    lastServiceKm: { type: Number, default: 0 },
    lastServiceDate: { type: Date },
    alignmentIntervalKm: { type: Number, default: 10000 },
    lastAlignmentKm: { type: Number, default: 0 },
    lastAlignmentDate: { type: Date },
  },
  documents: {
    insurance: { url: String, expiry: Date },
    puc: { url: String, expiry: Date },
    fitness: { url: String, expiry: Date },
    roadTax: { url: String, expiry: Date },
    rc: { url: String, expiry: Date },
    permit: { url: String, expiry: Date },
  },
  // RC verification result via QuickEKYC's RC Advance endpoint
  // (POST /rc/rc_advance). `raw` always preserves the untouched API
  // response so no data is lost even if a normalized field is wrong.
  rcVerification: {
    status: { type: String, enum: ['verified', 'failed', 'not_run'], default: 'not_run' },
    ownerName: { type: String },
    fatherName: { type: String },
    presentAddress: { type: String },
    permanentAddress: { type: String },
    registrationDate: { type: Date },
    rcStatus: { type: String },
    ownerNumber: { type: String },
    rtoCode: { type: String },
    registeredAt: { type: String },
    vehicleClass: { type: String },
    vehicleModel: { type: String },
    makerDescription: { type: String },
    bodyType: { type: String },
    fuelType: { type: String },
    color: { type: String },
    seatCapacity: { type: Number },
    cubicCapacity: { type: String },
    manufacturingDate: { type: String },
    chassisNumber: { type: String },
    engineNumber: { type: String },
    insuranceCompany: { type: String },
    insurancePolicyNumber: { type: String },
    insuranceValidUpto: { type: Date },
    fitnessValidUpto: { type: Date },
    taxUpto: { type: Date },
    puccUpto: { type: Date },
    financer: { type: String },
    blacklistStatus: { type: String },
    raw: { type: mongoose.Schema.Types.Mixed },
    analyzedAt: { type: Date },
    error: { type: String },
  },
  // Pending traffic Challan check result via QuickEKYC (POST /challan/challan).
  challanCheck: {
    status: { type: String, enum: ['checked', 'failed', 'not_run'], default: 'not_run' },
    totalChallans: { type: Number, default: 0 },
    totalPendingAmount: { type: Number, default: 0 },
    challans: [{
      challanNumber: { type: String },
      challanDate: { type: Date },
      amount: { type: Number },
      status: { type: String },
      offense: { type: String },
      location: { type: String },
    }],
    raw: { type: mongoose.Schema.Types.Mixed },
    analyzedAt: { type: Date },
    error: { type: String },
  },
}, { timestamps: true });

CarSchema.pre('save', function (next) {
  if (this.isModified('name') || this.isModified('registrationNo') || !this.slug) {
    this.slug =
      this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') +
      '-' +
      this.registrationNo.slice(-4).toLowerCase();
  }
  next();
});

CarSchema.index({ cityId: 1, isActive: 1 });
CarSchema.index({ cityId: 1, isActive: 1, type: 1, fuel: 1, transmission: 1 }); // fleet filters
CarSchema.index({ slug: 1 });   // car detail page lookup

module.exports = mongoose.model('Car', CarSchema);

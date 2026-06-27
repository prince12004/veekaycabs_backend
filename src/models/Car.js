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
  kmPackage: { type: String, default: '250 km/day' },
  images: [String],
  cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City', required: true },
  gpsDeviceId: { type: String },
  isActive: { type: Boolean, default: true },
  slug: { type: String, unique: true },
  features: [String],
  documents: {
    insurance: { url: String, expiry: Date },
    puc: { url: String, expiry: Date },
    fitness: { url: String, expiry: Date },
    roadTax: { url: String, expiry: Date },
    rc: { url: String, expiry: Date },
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

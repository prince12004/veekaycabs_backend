const mongoose = require('mongoose');

// Logs every RC verification / Challan check run from the admin Vehicle
// Verification tool, keyed by registration number — independent of whether
// that vehicle is in the fleet (Car collection) or not.
const VehicleCheckSchema = new mongoose.Schema({
  registrationNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
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
  challanCheck: {
    status: { type: String, enum: ['checked', 'failed', 'not_run'], default: 'not_run' },
    ownerName: { type: String },
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

module.exports = mongoose.model('VehicleCheck', VehicleCheckSchema);

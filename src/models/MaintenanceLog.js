const mongoose = require('mongoose');

const MaintenanceLogSchema = new mongoose.Schema({
  carId: { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
  category: {
    type: String,
    enum: ['Service', 'Fare', 'Fuel', 'Tyre', 'Denting Painting', 'Engine Work', 'Other'],
    default: 'Other',
  },
  amount: { type: Number, required: true },
  odometer: { type: Number },
  remark: { type: String, trim: true },
  date: { type: Date, default: Date.now, required: true },
}, { timestamps: true });

MaintenanceLogSchema.index({ carId: 1, date: -1 });

module.exports = mongoose.model('MaintenanceLog', MaintenanceLogSchema);

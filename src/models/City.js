const mongoose = require('mongoose');

const CitySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  state: { type: String, default: 'Delhi NCR' },
  isActive: { type: Boolean, default: true },
  pickupLocations: [{ name: String, address: String }],
  deliveryCharge: { type: Number, default: 500 },
}, { timestamps: true });

module.exports = mongoose.model('City', CitySchema);

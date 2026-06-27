const mongoose = require('mongoose');

const ContactRequestSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['general', 'tempo_traveller', 'support', 'complaint'],
    default: 'general',
  },
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String },
  subject: { type: String },
  message: { type: String },
  journeyDate: { type: Date },
  passengers: { type: Number },
  tripType: { type: String },
  pickupLocation: { type: String },
  destination: { type: String },
  specialRequirements: { type: String },
  status: { type: String, enum: ['new', 'contacted', 'resolved'], default: 'new' },
  adminNotes: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('ContactRequest', ContactRequestSchema);

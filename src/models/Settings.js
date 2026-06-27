const mongoose = require('mongoose');

// Singleton document — always just one settings record (_id = 'global')
const SettingsSchema = new mongoose.Schema({
  _id: { type: String, default: 'global' },

  // Company info
  companyName:    { type: String, default: 'Veekay Cabs' },
  tagline:        { type: String, default: "Delhi NCR's Most Trusted Self-Drive Car Rental" },
  gstNumber:      { type: String, default: '' },
  upiId:          { type: String, default: '' },
  razorpayKeyId:  { type: String, default: '' },

  // Contact
  phone1:         { type: String, default: '+91 99999 26867' },
  phone2:         { type: String, default: '' },
  phone3:         { type: String, default: '' },
  whatsapp:       { type: String, default: '+91 99999 26867' },
  email:          { type: String, default: 'sales@veekaycabs.com' },
  website:        { type: String, default: 'https://veekaycabs.com' },

  // Addresses
  addressDelhi:   { type: String, default: 'A 13, 1st Floor, Ganesh Nagar, New Delhi 110092' },
  addressLucknow: { type: String, default: '' },

  // Social media links
  facebook:       { type: String, default: '' },
  instagram:      { type: String, default: '' },
  youtube:        { type: String, default: '' },
  twitter:        { type: String, default: '' },
  linkedin:       { type: String, default: '' },

  // SEO defaults
  defaultMetaTitle:       { type: String, default: 'Veekay Cabs | Self Drive Car Rental Delhi NCR' },
  defaultMetaDescription: { type: String, default: 'Rent self-drive cars in Delhi NCR starting at ₹14/km. 100+ cars available.' },

  // KM policy
  includedKmPerDay: { type: Number, default: 250 },
  extraKmRate:      { type: Number, default: 12 },

  // Feature flags
  maintenanceMode: { type: Boolean, default: false },
  bookingEnabled:  { type: Boolean, default: true },
}, { _id: false, timestamps: true });

module.exports = mongoose.model('Settings', SettingsSchema);

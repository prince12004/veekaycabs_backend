/**
 * Seed 3 Tempo Travellers into the database.
 * Usage:  node src/scripts/seedTempo.js
 * Safe to re-run — skips vehicles already present by registrationNo.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const TempoTraveller = require('../models/TempoTraveller');

const TEMPOS = [
  {
    name: '9 Seater Tempo Traveller',
    registrationNo: 'DL1TT9001',
    seats: 9,
    fuel: 'Diesel',
    location: 'Delhi NCR',
    basePrice: 4000,
    pricePerDay: 5000,
    pricePerKm: 14,
    tollForExtraTrip: 500,
    refundableDeposit: 5000,
    homeDeliveryCharge: 500,
    homeDeliveryAvailable: true,
    shortDescription: 'Perfect for small family trips and corporate outings. 9-seater luxury Tempo Traveller with AC, push-back seats and music system.',
    features: ['AC', 'Push-back Seats', 'Music System', 'First Aid Kit', 'Blankets', 'Water Bottles'],
    showOnTop: true,
    isActive: true,
    images: [],
  },
  {
    name: '12 Seater Tempo Traveller',
    registrationNo: 'DL1TT1201',
    seats: 12,
    fuel: 'Diesel',
    location: 'Delhi NCR',
    basePrice: 5500,
    pricePerDay: 6500,
    pricePerKm: 16,
    tollForExtraTrip: 600,
    refundableDeposit: 5000,
    homeDeliveryCharge: 600,
    homeDeliveryAvailable: true,
    shortDescription: 'Spacious 12-seater ideal for medium-sized groups, pilgrimages and hill station trips. Full AC comfort with ample luggage space.',
    features: ['AC', 'Push-back Seats', 'LCD Screen', 'Music System', 'Reading Lights', 'Charging Points', 'First Aid Kit'],
    showOnTop: true,
    isActive: true,
    images: [],
  },
  {
    name: '17 Seater Tempo Traveller',
    registrationNo: 'DL1TT1701',
    seats: 17,
    fuel: 'Diesel',
    location: 'Delhi NCR',
    basePrice: 7000,
    pricePerDay: 8500,
    pricePerKm: 18,
    tollForExtraTrip: 800,
    refundableDeposit: 8000,
    homeDeliveryCharge: 800,
    homeDeliveryAvailable: true,
    shortDescription: 'Best for large groups, school trips and corporate tours. 17-seater luxury van with extra luggage space and all modern amenities.',
    features: ['AC', 'Push-back Seats', 'LCD Screen', 'DVD Player', 'Music System', 'Reading Lights', 'USB Charging', 'Curtains', 'First Aid Kit'],
    showOnTop: false,
    isActive: true,
    images: [],
  },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  let created = 0, skipped = 0;
  for (const data of TEMPOS) {
    const existing = await TempoTraveller.findOne({ registrationNo: data.registrationNo });
    if (existing) {
      console.log(`  ⏭  Skipped "${data.name}" (${data.registrationNo}) — already exists`);
      skipped++;
      continue;
    }
    await TempoTraveller.create(data);
    console.log(`  ✅ Created "${data.name}" (${data.registrationNo}) — ${data.seats} seater, ₹${data.pricePerKm}/km`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} already existed`);
  await mongoose.disconnect();
})();

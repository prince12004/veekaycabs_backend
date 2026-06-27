require('dotenv').config();
const mongoose = require('mongoose');

const IMAGES = {
  Hatchback: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&auto=format&fit=crop&q=80",
  SUV:       "https://images.unsplash.com/photo-1519641471654-76ce0107ad98?w=800&auto=format&fit=crop&q=80",
  Sedan:     "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&auto=format&fit=crop&q=80",
  MUV:       "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&auto=format&fit=crop&q=80",
  Luxury:    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80",
};

const NOIDA    = new mongoose.Types.ObjectId('6a28ec032106ed4971842a2e');
const GURGAON  = new mongoose.Types.ObjectId('6a28ec032106ed4971842a30');
const DELHI    = new mongoose.Types.ObjectId('6a28ec032106ed4971842a2c');

const CARS_TO_ADD = [
  // Noida
  { name:"Maruti Swift",    registrationNo:"UP16NB2001", modelYear:2022, type:"Hatchback", fuel:"Petrol",  transmission:"Manual",    seats:5, regularPrice:89,  weekendPrice:99,  securityDeposit:5000,  kmPackage:"200 km/day", cityId:NOIDA,   gpsDeviceId:"GPS-N01" },
  { name:"Hyundai Venue",   registrationNo:"UP16NB2002", modelYear:2023, type:"SUV",       fuel:"Petrol",  transmission:"Automatic", seats:5, regularPrice:119, weekendPrice:139, securityDeposit:8000,  kmPackage:"200 km/day", cityId:NOIDA,   gpsDeviceId:"GPS-N02" },
  { name:"Honda City",      registrationNo:"UP16NB2003", modelYear:2022, type:"Sedan",     fuel:"Petrol",  transmission:"Automatic", seats:5, regularPrice:119, weekendPrice:139, securityDeposit:8000,  kmPackage:"200 km/day", cityId:NOIDA,   gpsDeviceId:"GPS-N03" },
  { name:"Maruti Ertiga",   registrationNo:"UP16NB2004", modelYear:2022, type:"MUV",       fuel:"CNG",     transmission:"Manual",    seats:7, regularPrice:109, weekendPrice:129, securityDeposit:8000,  kmPackage:"200 km/day", cityId:NOIDA,   gpsDeviceId:"GPS-N04" },
  // Gurgaon
  { name:"Kia Seltos",      registrationNo:"HR26GB3001", modelYear:2023, type:"SUV",       fuel:"Diesel",  transmission:"Manual",    seats:5, regularPrice:129, weekendPrice:149, securityDeposit:10000, kmPackage:"250 km/day", cityId:GURGAON, gpsDeviceId:"GPS-G01" },
  { name:"Hyundai Creta",   registrationNo:"HR26GB3002", modelYear:2023, type:"SUV",       fuel:"Petrol",  transmission:"Automatic", seats:5, regularPrice:139, weekendPrice:159, securityDeposit:10000, kmPackage:"250 km/day", cityId:GURGAON, gpsDeviceId:"GPS-G02" },
  { name:"Maruti Baleno",   registrationNo:"HR26GB3003", modelYear:2023, type:"Hatchback", fuel:"Petrol",  transmission:"Manual",    seats:5, regularPrice:94,  weekendPrice:109, securityDeposit:5000,  kmPackage:"200 km/day", cityId:GURGAON, gpsDeviceId:"GPS-G03" },
  // Delhi extras
  { name:"Hyundai Venue",   registrationNo:"DL01AB2001", modelYear:2023, type:"SUV",       fuel:"Petrol",  transmission:"Automatic", seats:5, regularPrice:119, weekendPrice:139, securityDeposit:8000,  kmPackage:"200 km/day", cityId:DELHI,   gpsDeviceId:"GPS-D07" },
  { name:"Maruti Baleno",   registrationNo:"DL01AB2002", modelYear:2023, type:"Hatchback", fuel:"Petrol",  transmission:"Manual",    seats:5, regularPrice:94,  weekendPrice:109, securityDeposit:5000,  kmPackage:"200 km/day", cityId:DELHI,   gpsDeviceId:"GPS-D08" },
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Car = require('./src/models/Car');

  let added = 0, skipped = 0;
  for (const car of CARS_TO_ADD) {
    const exists = await Car.findOne({ registrationNo: car.registrationNo });
    if (exists) { console.log(`  Skip (already exists): ${car.name} ${car.registrationNo}`); skipped++; continue; }

    // generate slug
    const last4 = car.registrationNo.slice(-4).toLowerCase();
    const slug = car.name.toLowerCase().replace(/\s+/g, '-') + '-' + last4;
    const image = IMAGES[car.type] || IMAGES.Hatchback;

    await Car.create({ ...car, slug, images: [image], isActive: true, features: [] });
    console.log(`  Added: ${car.name} (${car.cityId === NOIDA ? 'Noida' : car.cityId === GURGAON ? 'Gurgaon' : 'Delhi'})`);
    added++;
  }
  console.log(`\nDone. Added: ${added}, Skipped: ${skipped}`);
  await mongoose.disconnect();
}

run().catch(console.error);

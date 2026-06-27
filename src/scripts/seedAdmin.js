require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const [email, password, name, role] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: node src/scripts/seedAdmin.js <email> <password> [name] [role]');
  console.error('Roles: super_admin | admin | tempo_admin | sub_admin');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const hashed = await bcrypt.hash(password, 10);
  let admin = await Admin.findOne({ email: email.toLowerCase() });

  if (admin) {
    admin.password = hashed;
    if (name) admin.name = name;
    if (role) admin.role = role;
    admin.permissions = {
      dashboard: true, fleet: true, bookings: true, users: true,
      finance: true, settings: true, tempoAdmin: true, content: true,
    };
    await admin.save();
    console.log(`✅ Updated admin "${email}" (role: ${admin.role})`);
  } else {
    admin = await Admin.create({
      name: name || 'Super Admin',
      email: email.toLowerCase(),
      password: hashed,
      role: role || 'super_admin',
      permissions: {
        dashboard: true, fleet: true, bookings: true, users: true,
        finance: true, settings: true, tempoAdmin: true, content: true,
      },
    });
    console.log(`✅ Created admin "${email}" (role: ${admin.role}) in "admins" collection`);
  }

  await mongoose.disconnect();
})();

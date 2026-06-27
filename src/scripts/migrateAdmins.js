/**
 * ONE-TIME MIGRATION: Move all role='admin' users from the User collection
 * to the separate Admin collection.
 *
 * Usage:  node src/scripts/migrateAdmins.js
 *
 * Safe to re-run — skips admins that already exist in the Admin collection.
 * Does NOT delete users from the User collection (you can clean up manually later).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Admin = require('../models/Admin');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // Find all users with role 'admin' in the User collection
  const adminUsers = await User.find({ role: 'admin' }).select('+password +refreshToken');
  console.log(`Found ${adminUsers.length} admin(s) in User collection\n`);

  let created = 0;
  let skipped = 0;

  for (const u of adminUsers) {
    const existing = await Admin.findOne({ email: u.email });
    if (existing) {
      console.log(`  ⏭  Skipped "${u.email}" — already in Admin collection (role: ${existing.role})`);
      skipped++;
      continue;
    }

    await Admin.create({
      name: u.name,
      email: u.email,
      // Password already hashed — store as-is
      password: u.password || 'MIGRATED_NO_PASSWORD',
      role: 'super_admin', // all existing admins get super_admin role; change below if needed
      permissions: {
        dashboard: true,
        fleet: true,
        bookings: true,
        users: true,
        finance: true,
        settings: true,
        tempoAdmin: true,
        content: true,
      },
      isActive: !u.isBlocked,
      refreshToken: u.refreshToken || undefined,
      lastLogin: u.lastLogin || undefined,
    });

    console.log(`  ✅ Migrated "${u.email}" → Admin collection (super_admin)`);
    created++;
  }

  console.log(`\nMigration complete: ${created} migrated, ${skipped} already existed`);
  console.log('\nNOTE: Original users in User collection were NOT deleted.');
  console.log('After verifying admin logins work, you can manually remove role=admin users from User collection.');

  await mongoose.disconnect();
})();

/**
 * Creates a Team Management entry for every distinct Booked By name on existing
 * bookings. Spelling variants that differ only by case, spacing or stray
 * punctuation ("Vivek sir " / "vivek Sir") become one member, named after the
 * most used spelling. Names that may or may not be the same person ("Akki" /
 * "Akki Chauhan") stay separate — merge them from the Team Management page.
 *
 * Usage:  node src/scripts/migrateTeamMembers.js            (preview only)
 *         node src/scripts/migrateTeamMembers.js --apply    (writes)
 *
 * Safe to re-run — skips names already linked to a member. Only inserts into
 * the teammembers collection; bookings are read, never written.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const TeamMember = require('../models/TeamMember');
const { normalizeName, cleanDisplayName, buildMemberIndex } = require('../utils/bookedBy');

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);

  const grouped = await Booking.aggregate([
    { $match: { bookedBy: { $type: 'string' } } },
    { $group: { _id: '$bookedBy', count: { $sum: 1 } } },
  ]);

  const byKey = new Map();
  for (const { _id: raw, count } of grouped) {
    const key = normalizeName(raw);
    if (!key) continue;
    const entry = byKey.get(key) || { total: 0, spellings: new Map() };
    const display = cleanDisplayName(raw);
    entry.total += count;
    entry.spellings.set(display, (entry.spellings.get(display) || 0) + count);
    byKey.set(key, entry);
  }

  const index = buildMemberIndex(await TeamMember.find());
  let created = 0;
  let skipped = 0;

  for (const [key, { total, spellings }] of [...byKey].sort((a, b) => b[1].total - a[1].total)) {
    // Most used spelling wins; on a tie prefer the capitalised one ("Prince").
    const [name] = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { caseFirst: 'upper' }))[0];
    if (index.has(key)) {
      skipped++;
      continue;
    }
    console.log(`${apply ? 'Created' : 'Would create'}: ${name} (${total} bookings)`);
    if (apply) await TeamMember.create({ name });
    created++;
  }

  console.log(`\n${apply ? 'Created' : 'Would create'} ${created}, already present ${skipped}.`);
  if (!apply) console.log('Preview only — re-run with --apply to write.');
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

/**
 * Moves bookings from old Booked By names to the agreed team member names and
 * tidies the team list to match. Spellings differing only by case, spacing or
 * stray punctuation are covered. Names not listed below are left alone.
 *
 * Only `bookedBy` changes on a booking. The previous value is kept on the same
 * booking as `bookedByOriginal`, which is what --rollback restores from.
 *
 * Usage:  node src/scripts/reassignTeamBookings.js              (preview only)
 *         node src/scripts/reassignTeamBookings.js --apply      (writes)
 *         node src/scripts/reassignTeamBookings.js --rollback   (restores bookings)
 *
 * Safe to re-run. Goes through the raw collection so bookings' updatedAt stays put.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const TeamMember = require('../models/TeamMember');
const { normalizeName } = require('../utils/bookedBy');

const REASSIGNMENTS = {
  'Akki Chauhan': ['Akki', 'Akki Chauhan', 'Akkii'],
  'Vivek Singh': ['Vivek', 'Vivek Sir', 'Vivek Singh', 'Parking', 'Her'],
  'Anuj Bhardwaj': ['Anuj Bhardwaj', 'Bobby', 'Bobby Sir', 'Bobby Bhai', 'Boby Bhai', 'Booby'],
  'Anil Gupta': ['Anil', 'Anil Sir', 'Anil Gupta'],
  'Preeti Singh': ['Preeti', 'Preeti Singh'],
};

const targetByKey = new Map(
  Object.entries(REASSIGNMENTS).flatMap(([target, names]) => names.map((n) => [normalizeName(n), target]))
);

const rollback = async () => {
  const bookings = Booking.collection;
  const result = await bookings.updateMany({ bookedByOriginal: { $exists: true } }, [
    { $set: { bookedBy: '$bookedByOriginal' } },
    { $unset: 'bookedByOriginal' },
  ]);
  console.log(`Restored ${result.modifiedCount} booking(s). Run migrateTeamMembers.js --apply to re-add the old names to the team.`);
};

const reassign = async (apply) => {
  const bookings = Booking.collection;
  const rawValues = (await bookings.distinct('bookedBy')).filter((v) => typeof v === 'string');
  let moved = 0;

  for (const raw of rawValues.sort()) {
    const target = targetByKey.get(normalizeName(raw));
    if (!target || raw === target) continue;
    const count = await bookings.countDocuments({ bookedBy: raw });
    console.log(`${apply ? 'Moved' : 'Would move'} ${count} from ${JSON.stringify(raw)} to ${target}`);
    if (apply) await bookings.updateMany({ bookedBy: raw }, [{ $set: { bookedByOriginal: raw, bookedBy: target } }]);
    moved += count;
  }

  // Old names leave outright rather than becoming aliases: no booking uses them
  // any more, and an alias would stop anyone new being added under that name.
  const members = await TeamMember.find();
  const targets = Object.keys(REASSIGNMENTS);
  for (const member of members) {
    const target = targetByKey.get(member.nameKey);
    if (target && target !== member.name) {
      console.log(`${apply ? 'Removed' : 'Would remove'} team member: ${member.name}`);
      if (apply) await member.deleteOne();
    }
  }
  for (const name of targets) {
    if (members.some((m) => m.nameKey === normalizeName(name))) continue;
    console.log(`${apply ? 'Added' : 'Would add'} team member: ${name}`);
    if (apply) await TeamMember.create({ name });
  }
  if (apply) {
    await TeamMember.updateMany(
      { nameKey: { $in: targets.map(normalizeName) } },
      { $set: { isDeleted: false, aliases: [] } }
    );
  }

  console.log(`\n${apply ? 'Moved' : 'Would move'} ${moved} booking(s).`);
  for (const name of targets) {
    const current = await bookings.countDocuments({ bookedBy: name });
    if (apply) console.log(`${name}: ${current}`);
  }
  if (!apply) console.log('Preview only — re-run with --apply to write.');
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  if (process.argv.includes('--rollback')) await rollback();
  else await reassign(process.argv.includes('--apply'));
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

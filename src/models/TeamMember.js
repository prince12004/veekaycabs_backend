const mongoose = require('mongoose');
const { normalizeName } = require('../utils/bookedBy');

// A sales team member selectable as a booking's "Booked By". Bookings keep
// storing the plain name string (never a reference), so renaming, merging or
// removing a member here can't alter historical bookings — `aliases` is what
// ties older spellings ("Akki chauhan") to this member for filters and reports.
const TeamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true },
    aliases: [{ type: String, trim: true }],
    isDeleted: { type: Boolean, default: false }, // soft-delete — hidden from the team list and dropdowns, still credited in reports
  },
  { timestamps: true }
);

TeamMemberSchema.pre('validate', function (next) {
  if (this.isModified('name')) this.nameKey = normalizeName(this.name);
  next();
});

module.exports = mongoose.model('TeamMember', TeamMemberSchema);

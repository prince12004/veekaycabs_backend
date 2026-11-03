// Booking.bookedBy was free text for years, so one person appears under many
// spellings ("Vivek sir ", "vivek Sir", "Akki`"). Comparisons go through this
// key instead of the raw value; the stored value itself is never rewritten.
const UNASSIGNED = '__unassigned__';

const normalizeName = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Cleans a raw value for display as a new member's name, keeping its casing.
const cleanDisplayName = (value) =>
  String(value ?? '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const memberKeys = (member) => [member.nameKey, ...(member.aliases || []).map(normalizeName)];

// key -> member, for every name and alias of the given members.
const buildMemberIndex = (members) => {
  const index = new Map();
  members.forEach((m) => memberKeys(m).forEach((key) => index.set(key, m)));
  return index;
};

// Resolves a filter value (member name, alias, raw legacy name or UNASSIGNED)
// to the exact stored strings it covers, ready for a `bookedBy` Mongo condition.
const buildBookedByCondition = async (value) => {
  const Booking = require('../models/Booking');
  const TeamMember = require('../models/TeamMember');
  const rawValues = (await Booking.distinct('bookedBy')).filter((v) => typeof v === 'string');

  if (value === UNASSIGNED) {
    return { $in: [null, ...rawValues.filter((v) => !normalizeName(v))] };
  }

  const key = normalizeName(value);
  const member = buildMemberIndex(await TeamMember.find()).get(key);
  const keys = new Set(member ? memberKeys(member) : [key]);
  return { $in: rawValues.filter((v) => keys.has(normalizeName(v))) };
};

module.exports = { UNASSIGNED, normalizeName, cleanDisplayName, memberKeys, buildMemberIndex, buildBookedByCondition };

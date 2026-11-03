const TeamMember = require('../../models/TeamMember');
const Booking = require('../../models/Booking');
const { normalizeName, buildMemberIndex } = require('../../utils/bookedBy');

const findNameConflict = (members, name, ignoreId) => {
  const hit = buildMemberIndex(members.filter((m) => String(m._id) !== String(ignoreId))).get(normalizeName(name));
  if (!hit) return null;
  if (hit.isDeleted) return `"${name}" belongs to a removed team member. Add it again from Add Member first.`;
  return hit.nameKey === normalizeName(name)
    ? `"${name}" is already a team member`
    : `"${name}" is already linked to ${hit.name}`;
};

// GET /api/admin/team — also backs the Booked By dropdowns, so any logged-in
// admin who can create or edit a booking can read it.
const getTeam = async (req, res) => {
  try {
    const [members, grouped] = await Promise.all([
      TeamMember.find().sort({ name: 1 }),
      Booking.aggregate([
        { $match: { isDeleted: { $ne: true }, bookedBy: { $type: 'string' } } },
        { $group: { _id: '$bookedBy', count: { $sum: 1 } } },
      ]),
    ]);
    const index = buildMemberIndex(members);
    const counts = new Map();
    grouped.forEach(({ _id, count }) => {
      const member = index.get(normalizeName(_id));
      if (member) counts.set(String(member._id), (counts.get(String(member._id)) || 0) + count);
    });
    const data = members
      .filter((m) => !m.isDeleted)
      .map((m) => ({ _id: m._id, name: m.name, aliases: m.aliases, bookingCount: counts.get(String(m._id)) || 0 }));
    return res.json({ success: true, data });
  } catch (error) {
    console.error('admin getTeam error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch team members' });
  }
};

// POST /api/admin/team — adding a name that belonged to a removed member brings
// that member back, along with their linked spellings.
const createTeamMember = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!normalizeName(name)) return res.status(400).json({ success: false, message: 'Name is required' });

    const members = await TeamMember.find();
    const existing = buildMemberIndex(members).get(normalizeName(name));
    if (existing && !existing.isDeleted) {
      return res.status(409).json({ success: false, message: findNameConflict(members, name) });
    }
    if (existing) {
      existing.isDeleted = false;
      if (existing.nameKey === normalizeName(name)) existing.name = name;
      await existing.save();
      return res.status(201).json({ success: true, data: existing });
    }

    const member = await TeamMember.create({ name });
    return res.status(201).json({ success: true, data: member });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This name is already a team member' });
    console.error('admin createTeamMember error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add team member' });
  }
};

// PUT /api/admin/team/:id — a rename keeps the old name as an alias, so bookings
// made under it stay credited to this member. `aliases` can only remove links.
const updateTeamMember = async (req, res) => {
  try {
    const members = await TeamMember.find();
    const member = members.find((m) => String(m._id) === req.params.id && !m.isDeleted);
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });

    if (Array.isArray(req.body.aliases)) {
      const keep = new Set(req.body.aliases.map(normalizeName));
      member.aliases = member.aliases.filter((a) => keep.has(normalizeName(a)));
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!normalizeName(name)) return res.status(400).json({ success: false, message: 'Name is required' });
      const conflict = findNameConflict(members, name, member._id);
      if (conflict) return res.status(409).json({ success: false, message: conflict });

      if (normalizeName(name) !== member.nameKey) member.aliases.push(member.name);
      member.name = name;
      member.aliases = member.aliases.filter((a) => normalizeName(a) !== normalizeName(name));
    }

    await member.save();
    return res.json({ success: true, data: member });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'This name is already a team member' });
    console.error('admin updateTeamMember error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update team member' });
  }
};

// POST /api/admin/team/:id/merge { targetId } — folds this member into another
// when both are the same person. Only team records change, never a booking.
const mergeTeamMember = async (req, res) => {
  try {
    if (req.params.id === req.body.targetId) {
      return res.status(400).json({ success: false, message: 'Choose a different team member to merge into' });
    }
    const [source, target] = await Promise.all([
      TeamMember.findOne({ _id: req.params.id, isDeleted: { $ne: true } }),
      TeamMember.findOne({ _id: req.body.targetId, isDeleted: { $ne: true } }),
    ]);
    if (!source || !target) return res.status(404).json({ success: false, message: 'Team member not found' });

    target.aliases = [...new Set([...target.aliases, source.name, ...source.aliases])];
    await target.save();
    await source.deleteOne();
    return res.json({ success: true, data: target });
  } catch (error) {
    console.error('admin mergeTeamMember error:', error);
    return res.status(500).json({ success: false, message: 'Failed to merge team members' });
  }
};

// DELETE /api/admin/team/:id — soft delete: leaves the dropdowns, while past
// bookings keep their name and stay credited in reports.
const deleteTeamMember = async (req, res) => {
  try {
    const member = await TeamMember.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!member) return res.status(404).json({ success: false, message: 'Team member not found' });
    return res.json({ success: true, message: 'Team member removed' });
  } catch (error) {
    console.error('admin deleteTeamMember error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove team member' });
  }
};

module.exports = { getTeam, createTeamMember, updateTeamMember, mergeTeamMember, deleteTeamMember };

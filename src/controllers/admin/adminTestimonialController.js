const Testimonial = require('../../models/Testimonial');

const getAll = async (req, res) => {
  try {
    const { active } = req.query;
    const filter = active === 'true' ? { isActive: true } : {};
    const data = await Testimonial.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
  }
};

const create = async (req, res) => {
  try {
    const { name, city, rating, review, carBooked, source, showOnHome, sortOrder } = req.body;
    if (!name || !review) return res.status(400).json({ success: false, message: 'Name and review required' });
    const t = await Testimonial.create({
      name, city, rating: Number(rating) || 5, review, carBooked, source,
      showOnHome: showOnHome !== 'false', sortOrder: Number(sortOrder) || 0,
      avatarUrl: req.file?.path || '',
    });
    return res.status(201).json({ success: true, data: t });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to create testimonial' });
  }
};

const update = async (req, res) => {
  try {
    const t = await Testimonial.findById(req.params.id);
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
    Object.assign(t, req.body);
    if (req.file?.path) t.avatarUrl = req.file.path;
    if (req.body.isActive !== undefined) t.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    if (req.body.showOnHome !== undefined) t.showOnHome = req.body.showOnHome === 'true' || req.body.showOnHome === true;
    if (req.body.rating) t.rating = Number(req.body.rating);
    await t.save();
    return res.json({ success: true, data: t });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

const remove = async (req, res) => {
  try {
    await Testimonial.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Testimonial deleted' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

module.exports = { getAll, create, update, remove };

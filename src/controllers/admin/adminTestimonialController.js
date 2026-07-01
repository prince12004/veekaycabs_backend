const Testimonial = require('../../models/Testimonial');
const { getFileUrl } = require('../../middleware/upload');

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
      avatarUrl: getFileUrl(req.file) || '',
    });
    return res.status(201).json({ success: true, data: t });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to create testimonial' });
  }
};

const update = async (req, res) => {
  try {
    const updates = { ...req.body };
    const newUrl = getFileUrl(req.file); if (newUrl) updates.avatarUrl = newUrl;
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    if (req.body.showOnHome !== undefined) updates.showOnHome = req.body.showOnHome === 'true' || req.body.showOnHome === true;
    if (req.body.rating) updates.rating = Number(req.body.rating);
    const t = await Testimonial.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!t) return res.status(404).json({ success: false, message: 'Not found' });
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

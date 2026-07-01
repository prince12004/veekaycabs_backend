const Slider = require('../../models/Slider');
const { getFileUrl } = require('../../middleware/upload');

const getAll = async (req, res) => {
  try {
    const slides = await Slider.find().sort({ sortOrder: 1, createdAt: -1 });
    return res.json({ success: true, data: slides });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch sliders' });
  }
};

const create = async (req, res) => {
  try {
    const { title, subtitle, linkUrl, linkText, displayPage, sortOrder } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const imageUrl = getFileUrl(req.file) || req.body.imageUrl || '';
    if (!imageUrl) return res.status(400).json({ success: false, message: 'Image required' });
    const slide = await Slider.create({ title, subtitle, imageUrl, linkUrl, linkText, displayPage, sortOrder: Number(sortOrder) || 0 });
    return res.status(201).json({ success: true, data: slide });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to create slider' });
  }
};

const update = async (req, res) => {
  try {
    const { title, subtitle, linkUrl, linkText, displayPage, sortOrder, isActive } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (subtitle !== undefined) updates.subtitle = subtitle;
    if (linkUrl !== undefined) updates.linkUrl = linkUrl;
    if (linkText !== undefined) updates.linkText = linkText;
    if (displayPage !== undefined) updates.displayPage = displayPage;
    if (sortOrder !== undefined) updates.sortOrder = Number(sortOrder);
    if (isActive !== undefined) updates.isActive = isActive === 'true' || isActive === true;
    const newUrl = getFileUrl(req.file);
    if (newUrl) updates.imageUrl = newUrl;
    const slide = await Slider.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!slide) return res.status(404).json({ success: false, message: 'Slider not found' });
    return res.json({ success: true, data: slide });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to update slider' });
  }
};

const remove = async (req, res) => {
  try {
    await Slider.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Slider deleted' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to delete slider' });
  }
};

module.exports = { getAll, create, update, remove };

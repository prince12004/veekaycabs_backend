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
    const slide = await Slider.findById(req.params.id);
    if (!slide) return res.status(404).json({ success: false, message: 'Slider not found' });
    const { title, subtitle, linkUrl, linkText, displayPage, sortOrder, isActive } = req.body;
    if (title !== undefined) slide.title = title;
    if (subtitle !== undefined) slide.subtitle = subtitle;
    if (linkUrl !== undefined) slide.linkUrl = linkUrl;
    if (linkText !== undefined) slide.linkText = linkText;
    if (displayPage !== undefined) slide.displayPage = displayPage;
    if (sortOrder !== undefined) slide.sortOrder = Number(sortOrder);
    if (isActive !== undefined) slide.isActive = isActive === 'true' || isActive === true;
    const newUrl = getFileUrl(req.file);
    if (newUrl) slide.imageUrl = newUrl;
    await slide.save();
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

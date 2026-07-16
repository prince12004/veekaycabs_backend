const CarSeoPage = require('../../models/CarSeoPage');

exports.getAllSeoPages = async (req, res) => {
  try {
    const pages = await CarSeoPage.find().sort({ createdAt: -1 });
    res.json({ success: true, data: pages });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSeoPageById = async (req, res) => {
  try {
    const page = await CarSeoPage.findById(req.params.id);
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, data: page });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createSeoPage = async (req, res) => {
  try {
    const { pageName, pageSlug, metaTitle, metaKeywords, metaDescription, h1Tag, author, robots, shortContent, content, parent, isActive } = req.body;
    const slug = pageSlug || pageName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const page = new CarSeoPage({ pageName, pageSlug: slug, metaTitle, metaKeywords, metaDescription, h1Tag, author, robots, shortContent, content, parent, isActive });
    await page.save();
    res.status(201).json({ success: true, data: page, message: 'SEO page created' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Slug already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSeoPage = async (req, res) => {
  try {
    const page = await CarSeoPage.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    res.json({ success: true, data: page, message: 'Page updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteSeoPage = async (req, res) => {
  try {
    await CarSeoPage.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

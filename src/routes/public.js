// Public-facing read-only routes for homepage content
const router = require('express').Router();
const Slider = require('../models/Slider');
const Testimonial = require('../models/Testimonial');
const Offer = require('../models/Offer');
const Settings = require('../models/Settings');
const PolicyPage = require('../models/PolicyPage');

router.get('/settings', async (req, res) => {
  try {
    let s = await Settings.findById('global').select('-razorpayKeyId -gstNumber');
    if (!s) s = await Settings.create({ _id: 'global' });
    return res.json({ success: true, data: s });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.get('/sliders', async (req, res) => {
  try {
    const { page } = req.query;
    const filter = { isActive: true };
    if (page) filter.displayPage = { $in: [page, 'both'] };
    const data = await Slider.find(filter).sort({ sortOrder: 1, createdAt: -1 });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.get('/testimonials', async (req, res) => {
  try {
    const data = await Testimonial.find({ isActive: true, showOnHome: true }).sort({ sortOrder: 1 }).limit(20);
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.get('/offers', async (req, res) => {
  try {
    const now = new Date();
    const data = await Offer.find({ isActive: true, $or: [{ validUntil: { $gt: now } }, { validUntil: null }] }).sort({ sortOrder: 1 });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.get('/pages/:key', async (req, res) => {
  try {
    const page = await PolicyPage.findOne({ pageKey: req.params.key });
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    return res.json({ success: true, data: page });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

module.exports = router;

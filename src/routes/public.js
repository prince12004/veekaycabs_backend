// Public-facing read-only routes for homepage content
const router = require('express').Router();
const Slider = require('../models/Slider');
const Testimonial = require('../models/Testimonial');
const Offer = require('../models/Offer');
const Settings = require('../models/Settings');
const PolicyPage = require('../models/PolicyPage');
const CarSeoPage = require('../models/CarSeoPage');
const TempoSeoPage = require('../models/TempoSeoPage');
const Car = require('../models/Car');
const { getLiveLocations, isConfigured, getAddress } = require('../services/gps');

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

// GET /api/public/gps/live — live fleet positions for the public /display board.
// Deliberately unauthenticated (this is a shareable "track my shuttle"-style
// link) and deliberately thin: no device IDs, battery, ignition, or booking
// customer info — just enough to plot the fleet, unlike the admin GPS feed.
const PUBLIC_IDLE_THRESHOLD_MINUTES = 30;

router.get('/gps/live', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.json({ success: true, configured: false, data: [] });
    }

    const cars = await Car.find(
      { gpsDeviceId: { $nin: [null, ''] }, isDeleted: { $ne: true } },
      'name registrationNo gpsDeviceId'
    ).lean();

    if (cars.length === 0) {
      return res.json({ success: true, configured: true, data: [] });
    }

    const liveMap = await getLiveLocations(cars.map((c) => c.gpsDeviceId));

    const data = await Promise.all(cars.map(async (car) => {
      const device = liveMap.get(car.gpsDeviceId);
      const base = { carId: car._id, name: car.name, regNo: car.registrationNo };

      if (!device) {
        return { ...base, status: 'offline', speed: 0, lat: null, lng: null, lastUpdate: null, address: null };
      }

      const lastUpdateMs = new Date(device.lastStatusUpdate || device.fixTime).getTime();
      const minutesSinceUpdate = (Date.now() - lastUpdateMs) / 60000;
      const status = minutesSinceUpdate > PUBLIC_IDLE_THRESHOLD_MINUTES
        ? 'offline'
        : device.attributes?.motion ? 'online' : 'idle';

      const lat = device.valid ? device.latitude : null;
      const lng = device.valid ? device.longitude : null;
      const address = device.address || (await getAddress(lat, lng));

      return { ...base, status, speed: device.speed || 0, lat, lng, lastUpdate: device.lastStatusUpdate, address };
    }));

    return res.json({ success: true, configured: true, data });
  } catch (error) {
    console.error('public gps live error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch GPS data' });
  }
});

// GET /api/public/car-seo-pages — lightweight list for the footer's "Popular
// Searches" link menu (imported from the old site's tbl_pages).
router.get('/car-seo-pages', async (req, res) => {
  try {
    const pages = await CarSeoPage.find({ isActive: true }, 'pageName pageSlug').sort({ pageName: 1 }).lean();
    return res.json({ success: true, data: pages });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

router.get('/car-seo-pages/:slug', async (req, res) => {
  try {
    const page = await CarSeoPage.findOne({ pageSlug: req.params.slug, isActive: true });
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    return res.json({ success: true, data: page });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/public/tempo-seo-pages — lightweight list, used by sitemap.xml
// generation (mirrors /car-seo-pages above).
router.get('/tempo-seo-pages', async (req, res) => {
  try {
    const pages = await TempoSeoPage.find({ isActive: true }, 'pageName pageSlug').sort({ pageName: 1 }).lean();
    return res.json({ success: true, data: pages });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed' });
  }
});

// GET /api/public/tempo-seo-pages/:slug — full page (content included), used
// by the /tempo-traveller/[slug] fallback when the slug isn't a real vehicle.
router.get('/tempo-seo-pages/:slug', async (req, res) => {
  try {
    const page = await TempoSeoPage.findOne({ pageSlug: req.params.slug, isActive: true });
    if (!page) return res.status(404).json({ success: false, message: 'Page not found' });
    return res.json({ success: true, data: page });
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

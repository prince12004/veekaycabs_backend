const Offer = require('../../models/Offer');
const { getFileUrl } = require('../../middleware/upload');

const getAll = async (req, res) => {
  try {
    const data = await Offer.find().sort({ sortOrder: 1, createdAt: -1 });
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch offers' });
  }
};

const create = async (req, res) => {
  try {
    const { title, description, couponCode, discountPct, validUntil, linkUrl, displayPage, sortOrder } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const offer = await Offer.create({
      title, description, couponCode, discountPct: Number(discountPct) || 0,
      validUntil: validUntil || undefined, linkUrl, displayPage,
      sortOrder: Number(sortOrder) || 0,
      imageUrl: getFileUrl(req.file) || '',
    });
    return res.status(201).json({ success: true, data: offer });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to create offer' });
  }
};

const update = async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id);
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });
    Object.assign(offer, req.body);
    const newUrl = getFileUrl(req.file); if (newUrl) offer.imageUrl = newUrl;
    if (req.body.isActive !== undefined) offer.isActive = req.body.isActive === 'true' || req.body.isActive === true;
    if (req.body.discountPct) offer.discountPct = Number(req.body.discountPct);
    await offer.save();
    return res.json({ success: true, data: offer });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to update offer' });
  }
};

const remove = async (req, res) => {
  try {
    await Offer.findByIdAndDelete(req.params.id);
    return res.json({ success: true, message: 'Offer deleted' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to delete offer' });
  }
};

module.exports = { getAll, create, update, remove };

const Coupon = require('../../models/Coupon');

// GET /api/admin/coupons
const getAllCoupons = async (req, res) => {
  try {
    const { isActive, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const [total, coupons] = await Promise.all([
      Coupon.countDocuments(filter),
      Coupon.find(filter)
        .populate('applicableCities', 'name')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

    return res.json({ success: true, data: coupons, total });
  } catch (error) {
    console.error('admin getAllCoupons error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

// POST /api/admin/coupons
const createCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.create(req.body);
    return res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Coupon code already exists' });
    }
    console.error('admin createCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create coupon' });
  }
};

// PUT /api/admin/coupons/:id
const updateCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.json({ success: true, data: coupon });
  } catch (error) {
    console.error('admin updateCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
};

// DELETE /api/admin/coupons/:id
const deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (error) {
    console.error('admin deleteCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
};

// PATCH /api/admin/coupons/:id/toggle
const toggleCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      [{ $set: { isActive: { $not: '$isActive' } } }],
      { new: true }
    );
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    return res.json({
      success: true,
      data: { _id: coupon._id, isActive: coupon.isActive },
      message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'}`,
    });
  } catch (error) {
    console.error('admin toggleCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle coupon' });
  }
};

module.exports = { getAllCoupons, createCoupon, updateCoupon, deleteCoupon, toggleCoupon };

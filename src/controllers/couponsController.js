const Coupon = require('../models/Coupon');

// POST /api/coupons/validate
const validateCoupon = async (req, res) => {
  try {
    const { code, bookingAmount, cityId } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required' });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() },
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code' });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
    }

    if (bookingAmount && coupon.minBookingAmount && bookingAmount < coupon.minBookingAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount of Rs. ${coupon.minBookingAmount} required`,
      });
    }

    if (coupon.applicableCities.length > 0 && cityId) {
      const applicable = coupon.applicableCities.map((id) => id.toString());
      if (!applicable.includes(cityId)) {
        return res.status(400).json({ success: false, message: 'Coupon not applicable for this city' });
      }
    }

    let discountAmount = 0;
    if (bookingAmount) {
      if (coupon.discountType === 'percentage') {
        discountAmount = Math.round((bookingAmount * coupon.discountValue) / 100);
        if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      } else {
        discountAmount = Math.min(coupon.discountValue, bookingAmount);
      }
    }

    return res.json({
      success: true,
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        maxDiscount: coupon.maxDiscount,
        description: coupon.description,
        discountAmount,
      },
    });
  } catch (error) {
    console.error('validateCoupon error:', error);
    return res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
};

module.exports = { validateCoupon };

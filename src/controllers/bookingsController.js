const Booking = require('../models/Booking');
const Car = require('../models/Car');
const City = require('../models/City');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { createOrder } = require('../services/razorpay');
const { sendBookingConfirmation } = require('../services/email');
const { sendBookingConfirmationSms } = require('../services/sms');
const { notifyAdminNewBooking } = require('../services/whatsapp');
const { v4: uuidv4 } = require('uuid');

const generateBookingId = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VK${ts}${rand}`;
};

const calculateCouponDiscount = (coupon, bookingFare) => {
  if (coupon.discountType === 'percentage') {
    const disc = (bookingFare * coupon.discountValue) / 100;
    return coupon.maxDiscount ? Math.min(disc, coupon.maxDiscount) : disc;
  }
  return Math.min(coupon.discountValue, bookingFare);
};

const calculateFare = (car, startTime, endTime, doorstepDelivery = false, coupon = null, cityDeliveryCharge = 500) => {
  const hours = Math.ceil((new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60));
  const isWeekend = [0, 6].includes(new Date(startTime).getDay());
  const rate = isWeekend ? car.weekendPrice : car.regularPrice;
  const bookingFare = hours * rate;
  const gst = Math.round(bookingFare * 0.18);
  const doorstepCharge = doorstepDelivery ? (cityDeliveryCharge || 500) : 0;
  const discountAmount = coupon ? Math.round(calculateCouponDiscount(coupon, bookingFare)) : 0;
  const totalAmount = bookingFare + gst + doorstepCharge - discountAmount + car.securityDeposit;
  const tokenAmount = Math.min(1000, Math.round(totalAmount * 0.2));
  const balanceDue = totalAmount - tokenAmount;
  return { hours, rate, bookingFare, gst, doorstepCharge, discountAmount, totalAmount, tokenAmount, balanceDue };
};

// POST /api/bookings/create
const createBooking = async (req, res) => {
  try {
    const {
      carId,
      startTime,
      endTime,
      pickupLocation,
      doorstepDelivery = false,
      couponCode,
    } = req.body;

    if (!carId || !startTime || !endTime || !pickupLocation) {
      return res.status(400).json({ success: false, message: 'carId, startTime, endTime, pickupLocation are required' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || start >= end || start < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    const car = await Car.findById(carId).populate('cityId');
    if (!car || !car.isActive) {
      return res.status(404).json({ success: false, message: 'Car not found or inactive' });
    }

    // Confirm availability
    const conflict = await Booking.findOne({
      carId,
      status: { $in: ['confirmed', 'active'] },
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Car is not available for selected dates' });
    }

    // Validate coupon
    let coupon = null;
    if (couponCode) {
      coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      });
      if (!coupon) {
        return res.status(400).json({ success: false, message: 'Invalid or expired coupon code' });
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
      }
      if (coupon.applicableCities.length > 0) {
        const applicable = coupon.applicableCities.map((id) => id.toString());
        if (!applicable.includes(car.cityId._id.toString())) {
          return res.status(400).json({ success: false, message: 'Coupon not applicable for this city' });
        }
      }
    }

    const cityDeliveryCharge = car.cityId?.deliveryCharge || 500;
    const fare = calculateFare(car, start, end, doorstepDelivery, coupon, cityDeliveryCharge);

    if (coupon && fare.bookingFare < (coupon.minBookingAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: `Minimum booking amount of Rs. ${coupon.minBookingAmount} required for this coupon`,
      });
    }

    const bookingId = generateBookingId();

    // Create Razorpay order for token amount
    let razorpayOrderId;
    try {
      const order = await createOrder(
        fare.tokenAmount,
        'INR',
        bookingId,
        { bookingId, userId: req.user._id.toString(), carName: car.name }
      );
      razorpayOrderId = order.id;
    } catch (rzpError) {
      console.error('Razorpay order error:', rzpError.message);
      // Continue without Razorpay in dev/test
    }

    const booking = await Booking.create({
      bookingId,
      userId: req.user._id,
      carId: car._id,
      cityId: car.cityId._id,
      startTime: start,
      endTime: end,
      pickupLocation,
      doorstepDelivery,
      doorstepCharge: fare.doorstepCharge,
      bookingFare: fare.bookingFare,
      securityDeposit: car.securityDeposit,
      discount: fare.discountAmount,
      gst: fare.gst,
      totalAmount: fare.totalAmount,
      tokenAmount: fare.tokenAmount,
      balanceDue: fare.balanceDue,
      couponCode: couponCode ? couponCode.toUpperCase() : undefined,
      razorpayOrderId,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      data: {
        booking,
        razorpayOrderId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        fareBreakdown: fare,
      },
    });
  } catch (error) {
    console.error('createBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
};

// GET /api/bookings/my
const getMyBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { userId: req.user._id };
    if (status) filter.status = status;

    const total = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
      .populate('carId', 'name images type fuel transmission seats registrationNo')
      .populate('cityId', 'name slug')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.json({
      success: true,
      data: bookings,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('getMyBookings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

// GET /api/bookings/:id
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('carId', 'name images type fuel transmission seats registrationNo regularPrice weekendPrice')
      .populate('cityId', 'name slug pickupLocations')
      .populate('userId', 'name mobile email');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Only owner or admin can view
    if (
      booking.userId._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('getBookingById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
};

// POST /api/bookings/:id/extend
const extendBooking = async (req, res) => {
  try {
    const { newEndTime } = req.body;
    if (!newEndTime) {
      return res.status(400).json({ success: false, message: 'newEndTime is required' });
    }

    const booking = await Booking.findById(req.params.id).populate('carId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (!['confirmed', 'active'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot extend this booking' });
    }

    const newEnd = new Date(newEndTime);
    if (newEnd <= booking.endTime) {
      return res.status(400).json({ success: false, message: 'New end time must be after current end time' });
    }

    // Check availability for extension
    const conflict = await Booking.findOne({
      carId: booking.carId._id,
      _id: { $ne: booking._id },
      status: { $in: ['confirmed', 'active'] },
      $or: [{ startTime: { $lt: newEnd }, endTime: { $gt: booking.endTime } }],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Car is not available for extension' });
    }

    const extraHours = Math.ceil((newEnd - booking.endTime) / (1000 * 60 * 60));
    const car = booking.carId;
    const isWeekend = [0, 6].includes(booking.endTime.getDay());
    const rate = isWeekend ? car.weekendPrice : car.regularPrice;
    const extraFare = extraHours * rate;
    const extraGst = Math.round(extraFare * 0.18);
    const extensionCost = extraFare + extraGst;

    let razorpayOrderId;
    try {
      const order = await createOrder(
        extensionCost,
        'INR',
        `EXT-${booking.bookingId}`,
        { bookingId: booking.bookingId, type: 'extension' }
      );
      razorpayOrderId = order.id;
    } catch (err) {
      console.error('Razorpay extension order error:', err.message);
    }

    return res.json({
      success: true,
      data: {
        extensionCost,
        extraHours,
        extraFare,
        extraGst,
        newEndTime: newEnd,
        razorpayOrderId,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error('extendBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend booking' });
  }
};

// POST /api/bookings/:id/cancel
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id).populate('carId');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (
      booking.userId.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Booking cannot be cancelled' });
    }

    // Cancellation policy: >24h before start = full token refund; 12-24h = 50%; <12h = no refund
    const hoursUntilStart = (booking.startTime - new Date()) / (1000 * 60 * 60);
    let refundAmount = 0;
    if (hoursUntilStart > 24) {
      refundAmount = booking.amountPaid;
    } else if (hoursUntilStart > 12) {
      refundAmount = Math.round(booking.amountPaid * 0.5);
    }

    booking.status = 'cancelled';
    booking.cancellationReason = reason || 'User cancelled';
    booking.cancelledAt = new Date();
    booking.refundAmount = refundAmount;
    await booking.save();

    // Notify user
    try {
      const user = await User.findById(booking.userId);
      if (user) {
        const { sendCancellationEmail } = require('../services/email');
        await sendCancellationEmail(user, booking);
      }
    } catch (notifyErr) {
      console.error('Cancellation notification error:', notifyErr.message);
    }

    return res.json({
      success: true,
      data: booking,
      message: `Booking cancelled. Refund of Rs. ${refundAmount} will be processed.`,
    });
  } catch (error) {
    console.error('cancelBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel booking' });
  }
};

module.exports = { createBooking, getMyBookings, getBookingById, extendBooking, cancelBooking };

const Booking = require('../../models/Booking');
const Car = require('../../models/Car');
const User = require('../../models/User');
const { v4: uuidv4 } = require('uuid');
const { sendBookingConfirmedToUser, notifyAdminNewBooking, sendBookingCancelledToUser } = require('../../services/whatsapp');

const generateBookingId = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VK${ts}${rand}`;
};

// GET /api/admin/bookings
const getAllBookings = async (req, res) => {
  try {
    const { status, city, from, to, page = 1, limit = 20, search, isOffline } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (city) filter.cityId = city;
    if (isOffline === 'true') filter.isOffline = true;
    if (isOffline === 'false') filter.isOffline = { $ne: true };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (search) {
      filter.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
      ];
    }

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .populate('userId', 'name mobile email')
        .populate('carId', 'name registrationNo type')
        .populate('cityId', 'name')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

    return res.json({
      success: true,
      data: bookings,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('admin getAllBookings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

// GET /api/admin/bookings/:id
const getBookingDetail = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name mobile email address kycStatus profilePic')
      .populate('carId')
      .populate('cityId');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('admin getBookingDetail error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
};

// POST /api/admin/bookings/offline
const createOfflineBooking = async (req, res) => {
  try {
    const {
      userId, carId, startTime, endTime, pickupLocation,
      paymentMode = 'offline_cash', doorstepDelivery = false,
      amountPaid = 0, notes,
    } = req.body;

    if (!carId || !startTime || !endTime || !pickupLocation) {
      return res.status(400).json({
        success: false,
        message: 'carId, startTime, endTime, pickupLocation are required',
      });
    }

    const car = await Car.findById(carId).populate('cityId');
    if (!car || !car.isActive) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    const conflict = await Booking.findOne({
      carId,
      status: { $in: ['confirmed', 'active'] },
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Car not available for selected dates' });
    }

    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    const isWeekend = [0, 6].includes(start.getDay());
    const rate = isWeekend ? car.weekendPrice : car.regularPrice;
    const bookingFare = hours * rate;
    const gst = Math.round(bookingFare * 0.18);
    const doorstepCharge = doorstepDelivery ? (car.cityId?.deliveryCharge || 500) : 0;
    const totalAmount = bookingFare + gst + doorstepCharge + car.securityDeposit;
    const tokenAmount = Math.min(1000, Math.round(totalAmount * 0.2));
    const balanceDue = totalAmount - amountPaid;

    // Use or create user
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { mobile, name } = req.body;
      if (!mobile) {
        return res.status(400).json({ success: false, message: 'userId or mobile required for offline booking' });
      }
      let user = await User.findOne({ mobile });
      if (!user) {
        user = await User.create({ mobile, name: name || `Walk-in ${mobile.slice(-4)}`, isVerified: true });
      }
      resolvedUserId = user._id;
    }

    const bookingId = generateBookingId();
    const booking = await Booking.create({
      bookingId,
      userId: resolvedUserId,
      carId: car._id,
      cityId: car.cityId._id,
      startTime: start,
      endTime: end,
      pickupLocation,
      doorstepDelivery,
      doorstepCharge,
      bookingFare,
      securityDeposit: car.securityDeposit,
      gst,
      totalAmount,
      tokenAmount,
      balanceDue,
      amountPaid,
      paymentMode,
      status: 'confirmed',
      isOffline: true,
      challanDetails: notes,
    });

    await User.findByIdAndUpdate(resolvedUserId, { $inc: { totalBookings: 1 } });

    const populated = await Booking.findById(booking._id)
      .populate('userId', 'name mobile')
      .populate('carId', 'name registrationNo')
      .populate('cityId', 'name');

    // Send WhatsApp confirmation for offline bookings too
    const offlineMobile = populated.userId?.mobile;
    if (offlineMobile && !String(offlineMobile).startsWith('google_')) {
      sendBookingConfirmedToUser(populated.userId, populated, populated.carId).catch(() => {});
    }

    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('admin createOfflineBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create offline booking' });
  }
};

// GET /api/admin/bookings/export
const exportBookings = async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const bookings = await Booking.find(filter)
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo')
      .populate('cityId', 'name')
      .sort({ createdAt: -1 })
      .limit(10000);

    const headers = [
      'Booking ID', 'User Name', 'Mobile', 'Email',
      'Car', 'Reg No', 'City', 'Start Time', 'End Time',
      'Status', 'Booking Fare', 'GST', 'Total Amount', 'Amount Paid', 'Payment Mode', 'Created At',
    ];

    const rows = bookings.map((b) => [
      b.bookingId,
      b.userId?.name || '',
      b.userId?.mobile || '',
      b.userId?.email || '',
      b.carId?.name || '',
      b.carId?.registrationNo || '',
      b.cityId?.name || '',
      b.startTime ? new Date(b.startTime).toLocaleString('en-IN') : '',
      b.endTime ? new Date(b.endTime).toLocaleString('en-IN') : '',
      b.status,
      b.bookingFare,
      b.gst,
      b.totalAmount,
      b.amountPaid,
      b.paymentMode,
      new Date(b.createdAt).toLocaleString('en-IN'),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bookings-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('admin exportBookings error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export bookings' });
  }
};

// PATCH /api/admin/bookings/:id/status
const updateBookingStatus = async (req, res) => {
  try {
    const { status, amountPaid, notes } = req.body;
    const allowed = ['pending', 'confirmed', 'active', 'completed', 'cancelled'];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    const update = {};
    if (status) update.status = status;
    if (amountPaid !== undefined) update.amountPaid = amountPaid;
    if (notes !== undefined) update.challanDetails = notes;

    const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type')
      .populate('cityId', 'name');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Send WhatsApp when admin confirms or cancels a booking
    const userMobile = booking.userId?.mobile;
    const hasRealMobile = userMobile && !String(userMobile).startsWith('google_');
    if (hasRealMobile) {
      if (status === 'confirmed' || status === 'active') {
        const car = booking.carId;
        sendBookingConfirmedToUser(booking.userId, booking, car).catch(() => {});
      } else if (status === 'cancelled') {
        sendBookingCancelledToUser(booking.userId, booking, booking.carId).catch(() => {});
      }
    }

    return res.json({ success: true, data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update booking' });
  }
};

// PUT /api/admin/bookings/:id — update dates, amount, notes
const updateBooking = async (req, res) => {
  try {
    const { startTime, endTime, totalAmount, amountPaid, notes, paymentMode } = req.body;
    const update = {};
    if (startTime) update.startTime = new Date(startTime);
    if (endTime)   update.endTime   = new Date(endTime);
    if (totalAmount !== undefined) {
      update.totalAmount = totalAmount;
      update.balanceDue  = totalAmount - (amountPaid !== undefined ? amountPaid : 0);
    }
    if (amountPaid !== undefined) {
      update.amountPaid = amountPaid;
      if (update.totalAmount !== undefined) {
        update.balanceDue = update.totalAmount - amountPaid;
      } else {
        // recalculate balanceDue using existing totalAmount
        const existing = await Booking.findById(req.params.id, 'totalAmount');
        if (existing) update.balanceDue = existing.totalAmount - amountPaid;
      }
    }
    if (notes !== undefined)       update.challanDetails = notes;
    if (paymentMode !== undefined) update.paymentMode    = paymentMode;

    const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type')
      .populate('cityId', 'name');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('admin updateBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update booking' });
  }
};

module.exports = { getAllBookings, getBookingDetail, createOfflineBooking, exportBookings, updateBookingStatus, updateBooking };

const Booking = require('../../models/Booking');
const Car = require('../../models/Car');
const User = require('../../models/User');
const { v4: uuidv4 } = require('uuid');
const { sendBookingConfirmedV2ToUser, notifyAdminNewBooking, sendBookingCancelledToUser, sendBookingInvoiceToUser, sendClosingBillToUser } = require('../../services/whatsapp');
const { getFileUrl } = require('../../middleware/upload');

const generateBookingId = () => {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VK${ts}${rand}`;
};

// GET /api/admin/bookings/schedule?date=YYYY-MM-DD&city=<id>&status=confirmed
// Day-wise car movement: "departures" = bookings starting that day (car going
// out to a customer), "arrivals" = bookings ending that day (car coming back
// to us). Bare "YYYY-MM-DD" parses as UTC midnight via plain `new Date()`,
// which drifts against server-local "now" (e.g. IST) — parse with an
// explicit local time instead, same fix as the car inactive-period cron.
const getSchedule = async (req, res) => {
  try {
    const { date, city, status } = req.query;
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);
    const dayStart = new Date(`${dateStr}T00:00:00`);
    const dayEnd = new Date(`${dateStr}T23:59:59.999`);

    const baseFilter = { isDeleted: { $ne: true } };
    if (city) baseFilter.cityId = city;
    baseFilter.status = status || { $ne: 'cancelled' };

    const populate = (q) => q
      .populate('userId', 'name mobile')
      .populate('carId', 'name registrationNo type')
      .populate('cityId', 'name');

    const [departures, arrivals] = await Promise.all([
      populate(Booking.find({ ...baseFilter, startTime: { $gte: dayStart, $lte: dayEnd } })).sort({ startTime: 1 }),
      populate(Booking.find({ ...baseFilter, endTime: { $gte: dayStart, $lte: dayEnd } })).sort({ endTime: 1 }),
    ]);

    return res.json({
      success: true,
      date: dateStr,
      data: { departures, arrivals },
    });
  } catch (error) {
    console.error('admin getSchedule error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch schedule' });
  }
};

// GET /api/admin/bookings/closing-bills?from=&to=&page=&limit=&search=
// Finance-style listing of every booking that's been through "Close Booking"
// (has a closingBill), filterable by the date it was CLOSED (not created/
// picked up) — separate from the day-to-day operational bookings list.
const getClosingBills = async (req, res) => {
  try {
    const { from, to, page = 1, limit = 20, search } = req.query;
    const conditions = [{ isDeleted: { $ne: true } }, { 'closingBill.closedAt': { $exists: true } }];
    if (from) conditions.push({ 'closingBill.closedAt': { $gte: new Date(`${from}T00:00:00`) } });
    if (to) conditions.push({ 'closingBill.closedAt': { $lte: new Date(`${to}T23:59:59.999`) } });
    if (search) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [matchingCars, matchingUsers] = await Promise.all([
        Car.find({ $or: [{ registrationNo: regex }, { name: regex }] }, '_id'),
        User.find({ $or: [{ name: regex }, { mobile: regex }] }, '_id'),
      ]);
      conditions.push({
        $or: [
          { bookingId: regex },
          { carId: { $in: matchingCars.map((c) => c._id) } },
          { userId: { $in: matchingUsers.map((u) => u._id) } },
        ],
      });
    }
    const filter = { $and: conditions };

    const [total, bookings] = await Promise.all([
      Booking.countDocuments(filter),
      Booking.find(filter)
        .populate('userId', 'name mobile email')
        .populate('carId', 'name registrationNo type')
        .populate('cityId', 'name')
        .sort({ 'closingBill.closedAt': -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

    return res.json({
      success: true,
      data: bookings,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)) || 1,
    });
  } catch (error) {
    console.error('admin getClosingBills error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch closing bills' });
  }
};

// GET /api/admin/bookings
const getAllBookings = async (req, res) => {
  try {
    const { status, city, from, to, page = 1, limit = 20, search, isOffline } = req.query;
    const filter = { isDeleted: { $ne: true } };

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
      // bookingId lives on Booking itself, but car reg. no. / name and
      // customer name / mobile live on referenced collections — resolve
      // those to ids first so they can join the same $or.
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [matchingCars, matchingUsers] = await Promise.all([
        Car.find({ $or: [{ registrationNo: regex }, { name: regex }] }, '_id'),
        User.find({ $or: [{ name: regex }, { mobile: regex }] }, '_id'),
      ]);
      filter.$or = [
        { bookingId: regex },
        { carId: { $in: matchingCars.map((c) => c._id) } },
        { userId: { $in: matchingUsers.map((u) => u._id) } },
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

// DELETE /api/admin/bookings/:id — soft delete: hides it from every list
// (admin + customer "My Bookings") and frees its dates for new bookings,
// but the row and its financial history are never actually removed.
const deleteBooking = async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('admin deleteBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete booking' });
  }
};

// POST /api/admin/bookings/offline
const createOfflineBooking = async (req, res) => {
  try {
    const {
      userId, carId, startTime, endTime, pickupLocation,
      paymentMode = 'offline_cash', doorstepDelivery = false, deliveryAddress,
      amountPaid = 0, notes,
      bookingFare: bookingFareOverride, securityDeposit: securityDepositOverride,
      doorstepCharge: doorstepChargeOverride,
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
      isDeleted: { $ne: true },
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Car not available for selected dates' });
    }

    // Rent and security default to the car's stored pricing, but the admin can
    // override either one on the offline-booking form (e.g. a negotiated walk-in
    // rate, or security actually collected differing from the car's default) —
    // whatever is entered there is what gets billed and shown on the invoice.
    const hasOverride = (v) => v !== undefined && v !== null && v !== '';
    if (hasOverride(bookingFareOverride) && (isNaN(Number(bookingFareOverride)) || Number(bookingFareOverride) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid rent amount' });
    }
    if (hasOverride(securityDepositOverride) && (isNaN(Number(securityDepositOverride)) || Number(securityDepositOverride) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid security deposit amount' });
    }
    if (hasOverride(doorstepChargeOverride) && (isNaN(Number(doorstepChargeOverride)) || Number(doorstepChargeOverride) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid pickup & drop charge' });
    }
    if (doorstepDelivery && !String(deliveryAddress || '').trim()) {
      return res.status(400).json({ success: false, message: 'Delivery address is required for pickup & drop' });
    }

    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    const isWeekend = [0, 6].includes(start.getDay());
    const rate = isWeekend ? car.weekendPrice : car.regularPrice;
    const bookingFare = hasOverride(bookingFareOverride) ? Number(bookingFareOverride) : hours * rate;
    const securityDeposit = hasOverride(securityDepositOverride) ? Number(securityDepositOverride) : car.securityDeposit;
    // No GST layered on top for offline bookings — the admin-entered Rent is
    // already the final walk-in price agreed with the customer, not a
    // pre-tax base. Adding 18% here silently inflated the total beyond what
    // was actually collected.
    const gst = 0;
    const defaultDoorstepCharge = car.doorstepDeliveryCharge ?? car.cityId?.deliveryCharge ?? 500;
    const doorstepCharge = doorstepDelivery
      ? (hasOverride(doorstepChargeOverride) ? Number(doorstepChargeOverride) : defaultDoorstepCharge)
      : 0;
    const totalAmount = bookingFare + gst + doorstepCharge + securityDeposit;
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
      deliveryAddress: doorstepDelivery ? deliveryAddress : undefined,
      doorstepCharge,
      bookingFare,
      securityDeposit,
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
      sendBookingConfirmedV2ToUser(populated.userId, populated, populated.carId).catch(() => { });
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
    const filter = { isDeleted: { $ne: true } };
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
      b.startTime ? new Date(b.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      b.endTime ? new Date(b.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '',
      b.status,
      b.bookingFare,
      b.gst,
      b.totalAmount,
      b.amountPaid,
      b.paymentMode,
      new Date(b.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
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
    const existing = await Booking.findById(req.params.id, 'totalAmount amountPaid');
    if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });

    const update = {};
    if (status) update.status = status;
    if (amountPaid !== undefined) update.amountPaid = amountPaid;
    if (notes !== undefined) update.challanDetails = notes;
    update.balanceDue = existing.totalAmount - (amountPaid !== undefined ? amountPaid : existing.amountPaid);

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
        sendBookingConfirmedV2ToUser(booking.userId, booking, car).catch(() => { });
        notifyAdminNewBooking(booking).catch(() => { });
      } else if (status === 'cancelled') {
        sendBookingCancelledToUser(booking.userId, booking, booking.carId).catch(() => { });
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
    const { startTime, endTime, totalAmount, amountPaid, notes, paymentMode, doorstepDelivery, deliveryAddress, doorstepCharge } = req.body;
    const update = {};
    if (startTime) update.startTime = new Date(startTime);
    if (endTime) update.endTime = new Date(endTime);

    if (doorstepDelivery !== undefined) {
      update.doorstepDelivery = !!doorstepDelivery;
      if (doorstepDelivery) {
        if (!String(deliveryAddress || '').trim()) {
          return res.status(400).json({ success: false, message: 'Delivery address is required for pickup & drop' });
        }
        if (deliveryAddress !== undefined) update.deliveryAddress = deliveryAddress;
        if (doorstepCharge !== undefined) {
          if (isNaN(Number(doorstepCharge)) || Number(doorstepCharge) < 0) {
            return res.status(400).json({ success: false, message: 'Invalid pickup & drop charge' });
          }
          update.doorstepCharge = Number(doorstepCharge);
        }
      } else {
        // Turned off — clear the associated address/charge so a stale
        // doorstep charge can't linger on the invoice.
        update.deliveryAddress = '';
        update.doorstepCharge = 0;
      }
    }

    if (totalAmount !== undefined || amountPaid !== undefined) {
      const existing = await Booking.findById(req.params.id, 'totalAmount amountPaid closingBill');
      if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });

      const finalTotal = totalAmount !== undefined ? totalAmount : existing.totalAmount;
      const finalPaid = amountPaid !== undefined ? amountPaid : existing.amountPaid;
      if (totalAmount !== undefined) update.totalAmount = totalAmount;
      if (amountPaid !== undefined) update.amountPaid = amountPaid;
      update.balanceDue = finalTotal - finalPaid;

      // If this booking was already closed, keep its final settlement bill
      // in sync with a corrected payment figure — otherwise the stored
      // closing bill (and any future WhatsApp send/reprint of it) would
      // keep showing the old, now-stale refund/balance-due amount.
      if (existing.closingBill?.closedAt && amountPaid !== undefined) {
        update['closingBill.advancePaid'] = amountPaid;
        update['closingBill.settlementAmount'] = (existing.closingBill.totalCharges || 0) - amountPaid;
      }
    }

    if (notes !== undefined) update.challanDetails = notes;
    if (paymentMode !== undefined) update.paymentMode = paymentMode;

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

// PATCH /api/admin/bookings/:id/extend — push the return time out (mirrors
// the customer-facing extend in bookingsController.js, but settles
// immediately instead of going through Razorpay: the admin sees/edits the
// computed extra charge and records whatever extra payment was collected,
// same "admin's entered number is final" convention as the rest of the
// offline-booking flow — no GST is layered on top here either.
const extendBooking = async (req, res) => {
  try {
    const { newEndTime, extraAmount: extraAmountOverride, additionalPaymentReceived = 0 } = req.body;
    if (!newEndTime) {
      return res.status(400).json({ success: false, message: 'newEndTime is required' });
    }

    const booking = await Booking.findById(req.params.id).populate('carId', 'regularPrice weekendPrice');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['confirmed', 'active'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Only confirmed or active bookings can be extended' });
    }

    const newEnd = new Date(newEndTime);
    if (isNaN(newEnd) || newEnd <= booking.endTime) {
      return res.status(400).json({ success: false, message: 'New end time must be after the current end time' });
    }

    const conflict = await Booking.findOne({
      carId: booking.carId._id,
      _id: { $ne: booking._id },
      status: { $in: ['confirmed', 'active'] },
      isDeleted: { $ne: true },
      $or: [{ startTime: { $lt: newEnd }, endTime: { $gt: booking.endTime } }],
    });
    if (conflict) {
      return res.status(409).json({ success: false, message: 'Car is already booked for someone else during the extended period' });
    }

    const extraHours = Math.ceil((newEnd - booking.endTime) / (1000 * 60 * 60));
    const car = booking.carId;
    const isWeekend = [0, 6].includes(booking.endTime.getDay());
    const rate = isWeekend ? car.weekendPrice : car.regularPrice;
    const defaultExtraAmount = extraHours * rate;
    const hasOverride = extraAmountOverride !== undefined && extraAmountOverride !== null && extraAmountOverride !== '';
    if (hasOverride && (isNaN(Number(extraAmountOverride)) || Number(extraAmountOverride) < 0)) {
      return res.status(400).json({ success: false, message: 'Invalid extra amount' });
    }
    if (isNaN(Number(additionalPaymentReceived)) || Number(additionalPaymentReceived) < 0) {
      return res.status(400).json({ success: false, message: 'Invalid additional payment amount' });
    }
    const extraAmount = hasOverride ? Number(extraAmountOverride) : defaultExtraAmount;
    const extraPaid = Number(additionalPaymentReceived) || 0;

    booking.endTime = newEnd;
    booking.bookingFare = (booking.bookingFare || 0) + extraAmount;
    booking.totalAmount = (booking.totalAmount || 0) + extraAmount;
    booking.amountPaid = (booking.amountPaid || 0) + extraPaid;
    booking.balanceDue = booking.totalAmount - booking.amountPaid;
    await booking.save();

    const populated = await Booking.findById(booking._id)
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type')
      .populate('cityId', 'name');

    return res.json({
      success: true,
      data: populated,
      message: `Booking extended by ${extraHours}h — Rs. ${extraAmount.toLocaleString('en-IN')} added`,
    });
  } catch (error) {
    console.error('admin extendBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to extend booking' });
  }
};

// PATCH /api/admin/bookings/:id/verification — save pickup/return condition checklist
const updateVehicleVerification = async (req, res) => {
  try {
    const { stage, condition } = req.body;
    if (!['pickup', 'return'].includes(stage)) {
      return res.status(400).json({ success: false, message: 'Invalid stage' });
    }
    if (!condition || typeof condition !== 'object') {
      return res.status(400).json({ success: false, message: 'Condition data required' });
    }

    const { fuel, odometer, challan, damage, extras, tyres, ac, documents } = condition;
    const field = stage === 'pickup' ? 'pickupCondition' : 'returnCondition';
    const update = {
      [`${field}.fuel`]: fuel,
      [`${field}.challan`]: challan,
      [`${field}.damage`]: damage,
      [`${field}.extras`]: extras,
      [`${field}.tyres`]: tyres,
      [`${field}.ac`]: ac,
      [`${field}.documents`]: documents,
      [`${field}.recordedAt`]: new Date(),
    };
    // odometer is a Number field — an empty string from the form would throw
    // a Mongoose CastError and fail the whole save, so only write it when a
    // real value was entered (this was the cause of "Failed to save return
    // verification" whenever the odometer box was left blank).
    if (odometer !== undefined && odometer !== '') {
      update[`${field}.odometer`] = odometer;
      if (stage === 'pickup') update.odometerStart = odometer;
      if (stage === 'return') update.odometerEnd = odometer;
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type')
      .populate('cityId', 'name');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('admin updateVehicleVerification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save verification' });
  }
};

// PATCH /api/admin/bookings/:id/close — record return-time charges, compute
// final settlement (balance due from / refund owed to customer), mark completed.
// Security deposit is deliberately excluded from totalCharges — it's a
// refundable hold already reflected in amountPaid, so any surplus over the
// actual charges naturally nets out as a refund below.
const closeBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('carId', 'regularPrice extraKmRate');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const {
      startingMeter, closingMeter, kmsLimit, extraKmRate, actualReturnTime, lateHourRate,
      pickupCharges, dropCharges, fastagStateTax, allStateChallan, overspeedingFine, fuelCharges, damageCharges, washingCharges, notes,
    } = req.body;

    const num = (v) => (v === undefined || v === '' || v === null ? 0 : Number(v));
    // If the admin's request didn't include a rate (client glitch, or a raw
    // API call), fall back to the car's own rate instead of silently
    // recording a Rs.0 charge — matches what the admin UI pre-fills anyway.
    const effectiveExtraKmRate = (extraKmRate === undefined || extraKmRate === '') ? (booking.carId?.extraKmRate || 0) : num(extraKmRate);
    const effectiveLateHourRate = (lateHourRate === undefined || lateHourRate === '') ? (booking.carId?.regularPrice || 0) : num(lateHourRate);

    // The pickup odometer is normally recorded during return verification;
    // if that step was skipped, let the admin supply it here instead of
    // getting stuck.
    if (booking.odometerStart === undefined || booking.odometerStart === null) {
      if (startingMeter === undefined || startingMeter === '') {
        return res.status(400).json({ success: false, message: 'Starting (pickup) meter reading is required — it was never recorded for this booking' });
      }
      booking.odometerStart = num(startingMeter);
    }

    if (closingMeter === undefined || closingMeter === '') {
      return res.status(400).json({ success: false, message: 'Closing meter reading is required' });
    }

    const totalKms = Math.max(0, num(closingMeter) - booking.odometerStart);
    const limit = num(kmsLimit);
    const extraKms = Math.max(0, totalKms - limit);
    const extraKmCharge = extraKms * effectiveExtraKmRate;

    // Late return — car came back after the scheduled endTime. Charged in
    // whole hours at the given hourly rate (defaults to the car's own
    // hourly rental rate on the frontend, but always editable).
    let lateHours = 0;
    let lateCharges = 0;
    const returnTime = actualReturnTime ? new Date(actualReturnTime) : null;
    if (returnTime && !isNaN(returnTime) && returnTime > booking.endTime) {
      lateHours = Math.ceil((returnTime - booking.endTime) / (60 * 60 * 1000));
      lateCharges = lateHours * effectiveLateHourRate;
    }

    const charges = {
      pickupCharges: num(pickupCharges),
      dropCharges: num(dropCharges),
      fastagStateTax: num(fastagStateTax),
      allStateChallan: num(allStateChallan),
      overspeedingFine: num(overspeedingFine),
      fuelCharges: num(fuelCharges),
      damageCharges: num(damageCharges),
      washingCharges: num(washingCharges),
    };
    const extraChargesTotal = Object.values(charges).reduce((a, b) => a + b, 0);

    const totalCharges = Math.round(
      (booking.bookingFare || 0) + (booking.gst || 0) - (booking.discount || 0) +
      (booking.doorstepCharge || 0) + extraKmCharge + lateCharges + extraChargesTotal
    );
    const advancePaid = booking.amountPaid || 0;
    const settlementAmount = totalCharges - advancePaid;

    booking.odometerEnd = num(closingMeter);
    booking.extraKmCharge = extraKmCharge;
    booking.status = 'completed';
    booking.closingBill = {
      totalKms, kmsLimit: limit, extraKms, extraKmRate: effectiveExtraKmRate,
      actualReturnTime: returnTime && !isNaN(returnTime) ? returnTime : undefined,
      lateHours, lateHourRate: effectiveLateHourRate, lateCharges,
      ...charges,
      totalCharges, advancePaid, settlementAmount,
      notes: notes || '',
      closedAt: new Date(),
      refundPaid: false,
    };

    await booking.save();
    const populated = await Booking.findById(booking._id)
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type')
      .populate('cityId', 'name');

    return res.json({ success: true, data: populated });
  } catch (error) {
    console.error('admin closeBooking error:', error);
    return res.status(500).json({ success: false, message: 'Failed to close booking' });
  }
};

// PATCH /api/admin/bookings/:id/refund-paid — manual confirmation that a
// computed refund was actually paid out to the customer (cash/UPI/bank,
// outside this system). No payment API is called here by design.
const markRefundPaid = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.closingBill || booking.closingBill.settlementAmount === undefined || booking.closingBill.settlementAmount >= 0) {
      return res.status(400).json({ success: false, message: 'No refund is due on this booking' });
    }
    booking.closingBill.refundPaid = true;
    booking.closingBill.refundPaidAt = new Date();
    await booking.save();
    return res.json({ success: true, data: booking });
  } catch (error) {
    console.error('admin markRefundPaid error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update refund status' });
  }
};

// POST /api/admin/bookings/:id/closing-bill/send-whatsapp — upload closing-bill PDF + send via WhatsApp
const sendClosingBillWhatsApp = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Bill PDF file required' });

    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.closingBill?.closedAt) {
      return res.status(400).json({ success: false, message: 'Close the booking before sending the final bill' });
    }

    const mobile = booking.userId?.mobile;
    if (!mobile || String(mobile).startsWith('google_')) {
      return res.status(400).json({ success: false, message: 'Customer has no valid WhatsApp number on file' });
    }

    const mediaUrl = getFileUrl(req.file);
    const result = await sendClosingBillToUser(mobile, booking.userId?.name || 'Customer', booking, booking.carId, mediaUrl);
    if (!result.success) {
      return res.status(502).json({ success: false, message: result.error || 'Failed to send bill via WhatsApp' });
    }

    booking.closingBill.billPdfUrl = mediaUrl;
    booking.closingBill.billSentAt = new Date();
    await booking.save();

    return res.json({ success: true });
  } catch (error) {
    console.error('admin sendClosingBillWhatsApp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send bill' });
  }
};

// POST /api/admin/bookings/:id/invoice/send-whatsapp — upload PDF + send via WhatsApp
const sendInvoiceWhatsApp = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Invoice PDF file required' });

    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name mobile email')
      .populate('carId', 'name registrationNo type');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const mobile = booking.userId?.mobile;
    if (!mobile || String(mobile).startsWith('google_')) {
      return res.status(400).json({ success: false, message: 'Customer has no valid WhatsApp number on file' });
    }

    const mediaUrl = getFileUrl(req.file);
    const result = await sendBookingInvoiceToUser(mobile, booking.userId?.name || 'Customer', booking, booking.carId, mediaUrl);
    if (!result.success) {
      return res.status(502).json({ success: false, message: result.error || 'Failed to send invoice via WhatsApp' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('admin sendInvoiceWhatsApp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send invoice' });
  }
};

module.exports = { getAllBookings, getSchedule, getClosingBills, getBookingDetail, createOfflineBooking, exportBookings, updateBookingStatus, updateBooking, extendBooking, deleteBooking, updateVehicleVerification, sendInvoiceWhatsApp, closeBooking, markRefundPaid, sendClosingBillWhatsApp };

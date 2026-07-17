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
      paymentMode = 'offline_cash', doorstepDelivery = false,
      amountPaid = 0, notes,
      bookingFare: bookingFareOverride, securityDeposit: securityDepositOverride,
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
    const doorstepCharge = doorstepDelivery ? (car.cityId?.deliveryCharge || 500) : 0;
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
      sendBookingConfirmedV2ToUser(populated.userId, populated, populated.carId).catch(() => {});
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
        sendBookingConfirmedV2ToUser(booking.userId, booking, car).catch(() => {});
        notifyAdminNewBooking(booking).catch(() => {});
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

    if (totalAmount !== undefined || amountPaid !== undefined) {
      const existing = await Booking.findById(req.params.id, 'totalAmount amountPaid closingBill');
      if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });

      const finalTotal = totalAmount !== undefined ? totalAmount : existing.totalAmount;
      const finalPaid = amountPaid !== undefined ? amountPaid : existing.amountPaid;
      if (totalAmount !== undefined) update.totalAmount = totalAmount;
      if (amountPaid !== undefined)  update.amountPaid  = amountPaid;
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
      [`${field}.odometer`]: odometer,
      [`${field}.challan`]: challan,
      [`${field}.damage`]: damage,
      [`${field}.extras`]: extras,
      [`${field}.tyres`]: tyres,
      [`${field}.ac`]: ac,
      [`${field}.documents`]: documents,
      [`${field}.recordedAt`]: new Date(),
    };
    if (stage === 'pickup' && odometer !== undefined && odometer !== '') update.odometerStart = odometer;
    if (stage === 'return' && odometer !== undefined && odometer !== '') update.odometerEnd = odometer;

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
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const {
      startingMeter, closingMeter, kmsLimit, extraKmRate, actualReturnTime, lateHourRate,
      pickupCharges, dropCharges, fastagStateTax, allStateChallan, overspeedingFine, fuelCharges, damageCharges, washingCharges, notes,
    } = req.body;

    const num = (v) => (v === undefined || v === '' || v === null ? 0 : Number(v));

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
    const extraKmCharge = extraKms * num(extraKmRate);

    // Late return — car came back after the scheduled endTime. Charged in
    // whole hours at the given hourly rate (defaults to the car's own
    // hourly rental rate on the frontend, but always editable).
    let lateHours = 0;
    let lateCharges = 0;
    const returnTime = actualReturnTime ? new Date(actualReturnTime) : null;
    if (returnTime && !isNaN(returnTime) && returnTime > booking.endTime) {
      lateHours = Math.ceil((returnTime - booking.endTime) / (60 * 60 * 1000));
      lateCharges = lateHours * num(lateHourRate);
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
      totalKms, kmsLimit: limit, extraKms, extraKmRate: num(extraKmRate),
      actualReturnTime: returnTime && !isNaN(returnTime) ? returnTime : undefined,
      lateHours, lateHourRate: num(lateHourRate), lateCharges,
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

module.exports = { getAllBookings, getBookingDetail, createOfflineBooking, exportBookings, updateBookingStatus, updateBooking, deleteBooking, updateVehicleVerification, sendInvoiceWhatsApp, closeBooking, markRefundPaid, sendClosingBillWhatsApp };

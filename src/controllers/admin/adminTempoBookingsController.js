const TempoBooking = require('../../models/TempoBooking');
const TempoTraveller = require('../../models/TempoTraveller');
const User = require('../../models/User');

exports.getAllTempoBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = { isDeleted: { $ne: true } };
    if (status) filter.status = status;

    const [bookings, total] = await Promise.all([
      TempoBooking.find(filter)
        .populate('userId', 'name mobile email')
        .populate('tempoId', 'name registrationNo seats')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit)),
      TempoBooking.countDocuments(filter),
    ]);
    res.json({ success: true, data: bookings, total, page: Number(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTempoBookingById = async (req, res) => {
  try {
    const booking = await TempoBooking.findById(req.params.id)
      .populate('userId', 'name mobile email profilePic')
      .populate('tempoId', 'name registrationNo seats location images');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createOfflineTempoBooking = async (req, res) => {
  try {
    const {
      userId, tempoId, tripType, pickupCity, destination, pickupLocation,
      startTime, endTime, totalDays, passengers, baseFare, gst, totalAmount,
      tokenAmount, balanceDue, paymentMode, notes,
    } = req.body;

    const booking = new TempoBooking({
      userId, tempoId, tripType, pickupCity, destination, pickupLocation,
      startTime, endTime, totalDays, passengers: passengers || 1,
      baseFare, gst: gst || 0, totalAmount,
      tokenAmount: tokenAmount || totalAmount,
      balanceDue: balanceDue || 0,
      amountPaid: tokenAmount || totalAmount,
      paymentMode: paymentMode || 'offline_cash',
      status: 'confirmed',
      isOffline: true,
      notes,
    });
    await booking.save();
    res.status(201).json({ success: true, data: booking, message: 'Offline booking created' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTempoBooking = async (req, res) => {
  try {
    const booking = await TempoBooking.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking, message: 'Booking updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Soft delete: hides it from lists, never wipes the row
exports.deleteTempoBooking = async (req, res) => {
  try {
    const booking = await TempoBooking.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markCarReceived = async (req, res) => {
  try {
    const booking = await TempoBooking.findByIdAndUpdate(
      req.params.id,
      { carReceived: true, status: 'active' },
      { new: true }
    );
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

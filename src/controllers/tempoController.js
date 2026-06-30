const TempoTraveller = require('../models/TempoTraveller');
const TempoBooking = require('../models/TempoBooking');

exports.getAvailableTempos = async (req, res) => {
  try {
    const { seats, startDate, endDate } = req.query;
    const filter = { isActive: true };
    if (seats) filter.seats = { $gte: Number(seats) };

    const tempos = await TempoTraveller.find(filter).sort({ showOnTop: -1, basePrice: 1 });
    res.json({ success: true, data: tempos });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTempoBySlug = async (req, res) => {
  try {
    const tempo = await TempoTraveller.findOne({ slug: req.params.slug, isActive: true });
    if (!tempo) return res.status(404).json({ success: false, message: 'Tempo not found' });
    res.json({ success: true, data: tempo });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTempoBooking = async (req, res) => {
  try {
    const {
      tempoId, tripType, pickupCity, destination, pickupLocation,
      startTime, endTime, totalDays, passengers,
      baseFare, gst, totalAmount, tokenAmount, balanceDue, securityDeposit, paymentMode,
    } = req.body;

    const booking = new TempoBooking({
      userId: req.user._id,
      tempoId, tripType, pickupCity, destination, pickupLocation,
      startTime, endTime, totalDays, passengers: passengers || 1,
      baseFare, gst: gst || 0, totalAmount,
      tokenAmount, balanceDue,
      securityDeposit: securityDeposit || 0,
      paymentMode: paymentMode || 'online',
      status: 'pending',
    });
    await booking.save();
    res.status(201).json({ success: true, data: booking, message: 'Booking created' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyTempoBookings = async (req, res) => {
  try {
    const bookings = await TempoBooking.find({ userId: req.user._id })
      .populate('tempoId', 'name registrationNo seats images location')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getTempoBookingById = async (req, res) => {
  try {
    const booking = await TempoBooking.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('tempoId', 'name registrationNo seats images location basePrice pricePerDay');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.cancelTempoBooking = async (req, res) => {
  try {
    const booking = await TempoBooking.findOne({ _id: req.params.id, userId: req.user._id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (['completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this booking' });
    }
    booking.status = 'cancelled';
    booking.cancellationReason = req.body.reason || 'Cancelled by user';
    booking.cancelledAt = new Date();
    await booking.save();
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

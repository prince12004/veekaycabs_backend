const Booking = require('../../models/Booking');
const User = require('../../models/User');

// GET /api/admin/reports/revenue
const getRevenueReport = async (req, res) => {
  try {
    const { from, to, groupBy = 'day' } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [revenueData, cityBreakdown, summary] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            totalRevenue: { $sum: '$totalAmount' },
            collectedRevenue: { $sum: '$amountPaid' },
            bookingCount: { $sum: 1 },
            avgBookingValue: { $avg: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: '$cityId',
            totalRevenue: { $sum: '$totalAmount' },
            bookingCount: { $sum: 1 },
          },
        },
        { $lookup: { from: 'cities', localField: '_id', foreignField: '_id', as: 'city' } },
        { $unwind: { path: '$city', preserveNullAndEmptyArrays: true } },
        { $project: { cityName: '$city.name', totalRevenue: 1, bookingCount: 1 } },
        { $sort: { totalRevenue: -1 } },
      ]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
            isDeleted: { $ne: true },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$totalAmount' },
            collectedRevenue: { $sum: '$amountPaid' },
            bookingCount: { $sum: 1 },
            avgBookingValue: { $avg: '$totalAmount' },
          },
        },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        summary: summary[0] || { totalRevenue: 0, collectedRevenue: 0, bookingCount: 0, avgBookingValue: 0 },
        revenueData,
        cityBreakdown,
      },
    });
  } catch (error) {
    console.error('admin getRevenueReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate revenue report' });
  }
};

// GET /api/admin/reports/car-revenue
const getCarRevenueReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const revenueData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate, $lte: toDate },
          status: { $in: ['confirmed', 'active', 'completed'] },
          isDeleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            carId: '$carId',
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          },
          totalRevenue: { $sum: '$totalAmount' },
          collectedRevenue: { $sum: '$amountPaid' },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1, '_id.carId': 1 } },
      {
        $lookup: {
          from: 'cars',
          localField: '_id.carId',
          foreignField: '_id',
          as: 'car',
        },
      },
      { $unwind: { path: '$car', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          month: '$_id.month',
          carId: '$_id.carId',
          totalRevenue: 1,
          collectedRevenue: 1,
          bookingCount: 1,
          carName: '$car.name',
          registrationNo: '$car.registrationNo',
        },
      },
    ]);

    return res.json({ success: true, data: revenueData });
  } catch (error) {
    console.error('admin getCarRevenueReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate car revenue report' });
  }
};

// GET /api/admin/reports/bookings
const getBookingStats = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [statusBreakdown, paymentModeBreakdown, topCars, cancellationRate] = await Promise.all([
      Booking.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate }, isDeleted: { $ne: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
            isDeleted: { $ne: true },
          },
        },
        { $group: { _id: '$paymentMode', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
            isDeleted: { $ne: true },
          },
        },
        { $group: { _id: '$carId', bookings: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
        { $sort: { bookings: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'cars', localField: '_id', foreignField: '_id', as: 'car' } },
        { $unwind: { path: '$car', preserveNullAndEmptyArrays: true } },
        { $project: { carName: '$car.name', registrationNo: '$car.registrationNo', bookings: 1, revenue: 1 } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const rate = cancellationRate[0];
    const cancellationPct = rate && rate.total > 0
      ? Math.round((rate.cancelled / rate.total) * 100)
      : 0;

    return res.json({
      success: true,
      data: { statusBreakdown, paymentModeBreakdown, topCars, cancellationRate: cancellationPct },
    });
  } catch (error) {
    console.error('admin getBookingStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate booking stats' });
  }
};

// GET /api/admin/reports/settlements?from=&to=
// Full collection/refund exposure across ALL bookings (date range applies to
// createdAt, same meaning throughout this report) — not just closed ones:
//   - Pending Collection covers running/active/confirmed bookings too (using
//     the live booking.balanceDue) AND closed bookings (using
//     closingBill.settlementAmount, since extra-km/late/damage charges added
//     at closing time make the top-level balanceDue stale once a bill is
//     closed — closingBill.settlementAmount is the authoritative final due).
//   - Pending Refunds only exists post-closing (a refund is only known once
//     the final bill reconciles the security deposit), so it's always sourced
//     from closingBill.settlementAmount.
//   - statusCounts / closedCount answer "how many pending / confirmed /
//     active / completed / cancelled / closed" for the same date range.
// Self-correcting: once an admin records the recovered balance (Edit Booking
// → Amount Paid) or hits "Mark Refund Paid", updateBooking/markRefundPaid
// already keep balanceDue / closingBill.settlementAmount / refundPaid in
// sync, so a booking drops out of these lists on its own.
const getSettlementsReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateConditions = [];
    if (from) dateConditions.push({ createdAt: { $gte: new Date(`${from}T00:00:00`) } });
    if (to) dateConditions.push({ createdAt: { $lte: new Date(`${to}T23:59:59.999`) } });
    const dateFilter = dateConditions.length ? { $and: dateConditions } : {};
    const notDeleted = { isDeleted: { $ne: true } };

    const [bookings, statusAgg, closedCount] = await Promise.all([
      Booking.find({ ...notDeleted, ...dateFilter, status: { $ne: 'cancelled' } })
        .select('bookingId userId carId status totalAmount amountPaid balanceDue closingBill')
        .populate('userId', 'name mobile')
        .populate('carId', 'name registrationNo')
        .sort({ createdAt: -1 }),
      Booking.aggregate([
        { $match: { ...notDeleted, ...dateFilter } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.countDocuments({ ...notDeleted, ...dateFilter, 'closingBill.closedAt': { $exists: true } }),
    ]);

    const statusCounts = { pending: 0, confirmed: 0, active: 0, completed: 0, cancelled: 0 };
    statusAgg.forEach((s) => { if (s._id in statusCounts) statusCounts[s._id] = s.count; });

    const pendingCollection = [];
    const pendingRefunds = [];
    let totalPendingCollection = 0;
    let totalPendingRefunds = 0;

    for (const b of bookings) {
      const isClosed = !!b.closingBill?.closedAt;
      const row = {
        bookingId: b._id,
        bookingCode: b.bookingId,
        customer: b.userId?.name || 'Unknown',
        mobile: b.userId?.mobile || '',
        car: b.carId?.name || '',
        regNo: b.carId?.registrationNo || '',
        status: b.status,
        closed: isClosed,
      };
      if (isClosed) {
        const amount = b.closingBill.settlementAmount || 0;
        if (amount > 0) {
          pendingCollection.push({ ...row, amount });
          totalPendingCollection += amount;
        } else if (amount < 0 && !b.closingBill.refundPaid) {
          pendingRefunds.push({ ...row, amount: Math.abs(amount) });
          totalPendingRefunds += Math.abs(amount);
        }
      } else if ((b.balanceDue || 0) > 0) {
        pendingCollection.push({ ...row, amount: b.balanceDue });
        totalPendingCollection += b.balanceDue;
      }
    }
    pendingCollection.sort((a, b) => b.amount - a.amount);

    return res.json({
      success: true,
      data: {
        statusCounts,
        closedCount,
        pendingCollection,
        pendingRefunds,
        totalPendingCollection,
        totalPendingRefunds,
      },
    });
  } catch (error) {
    console.error('admin getSettlementsReport error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate settlements report' });
  }
};

module.exports = { getRevenueReport, getBookingStats, getCarRevenueReport, getSettlementsReport };

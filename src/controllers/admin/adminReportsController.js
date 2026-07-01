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

// GET /api/admin/reports/bookings
const getBookingStats = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const [statusBreakdown, paymentModeBreakdown, topCars, cancellationRate] = await Promise.all([
      Booking.aggregate([
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
          },
        },
        { $group: { _id: '$paymentMode', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate, $lte: toDate },
            status: { $in: ['confirmed', 'active', 'completed'] },
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
        { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
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

module.exports = { getRevenueReport, getBookingStats };

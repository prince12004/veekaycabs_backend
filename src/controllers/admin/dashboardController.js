const Booking = require('../../models/Booking');
const User = require('../../models/User');
const UserDocument = require('../../models/UserDocument');
const Car = require('../../models/Car');

// GET /api/admin/dashboard/stats
const getDashboardStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      todayRevenueResult,
      activeBookings,
      newUsersToday,
      pendingKyc,
      totalCars,
      activeCars,
      totalBookings,
      completedBookings,
    ] = await Promise.all([
      Booking.aggregate([
        {
          $match: {
            status: 'confirmed',
            createdAt: { $gte: todayStart, $lte: todayEnd },
          },
        },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
      Booking.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd }, role: 'user' }),
      User.countDocuments({ kycStatus: 'pending' }),
      Car.countDocuments({}),
      Car.countDocuments({ isActive: true }),
      Booking.countDocuments({ status: { $in: ['confirmed', 'active', 'completed'] } }),
      Booking.countDocuments({ status: 'completed' }),
    ]);

    const todayRevenue = todayRevenueResult[0]?.total || 0;
    const fleetUtilization = totalCars > 0 ? Math.round((activeCars / totalCars) * 100) : 0;

    return res.json({
      success: true,
      data: {
        todayRevenue,
        activeBookings,
        newUsersToday,
        pendingKyc,
        totalCars,
        activeCars,
        fleetUtilization,
        totalBookings,
        completedBookings,
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
};

// GET /api/admin/dashboard/insights
const getDashboardInsights = async (req, res) => {
  try {
    const { from, to, groupBy = 'day' } = req.query;
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const dateFormat = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const bookingData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate, $lte: toDate },
          status: { $in: ['confirmed', 'active', 'completed'] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          bookings: { $sum: 1 },
          revenue: { $sum: '$amountPaid' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const cityBreakdown = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: fromDate, $lte: toDate },
          status: { $in: ['confirmed', 'active', 'completed'] },
        },
      },
      { $group: { _id: '$cityId', bookings: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
      {
        $lookup: {
          from: 'cities',
          localField: '_id',
          foreignField: '_id',
          as: 'city',
        },
      },
      { $unwind: { path: '$city', preserveNullAndEmptyArrays: true } },
      { $project: { cityName: '$city.name', bookings: 1, revenue: 1 } },
      { $sort: { bookings: -1 } },
    ]);

    return res.json({
      success: true,
      data: { bookingData, cityBreakdown },
    });
  } catch (error) {
    console.error('getDashboardInsights error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch insights' });
  }
};

module.exports = { getDashboardStats, getDashboardInsights };

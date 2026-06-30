const Booking = require('../../models/Booking');
const User = require('../../models/User');
const UserDocument = require('../../models/UserDocument');
const Car = require('../../models/Car');
const ContactRequest = require('../../models/ContactRequest');
const TempoBooking = require('../../models/TempoBooking');

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
      recentBookings,
      allCarsForExpiry,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { status: 'confirmed', createdAt: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]),
      Booking.countDocuments({ status: 'active' }),
      User.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd }, role: 'user' }),
      User.countDocuments({ kycStatus: 'pending' }),
      Car.countDocuments({}),
      Car.countDocuments({ isActive: true }),
      Booking.countDocuments({ status: { $in: ['confirmed', 'active', 'completed'] } }),
      Booking.countDocuments({ status: 'completed' }),
      Booking.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('userId', 'name')
        .populate('carId', 'name')
        .populate('cityId', 'name')
        .lean(),
      Car.find({ isActive: true }).populate('cityId', 'name').lean(),
    ]);

    const todayRevenue = todayRevenueResult[0]?.total || 0;
    const fleetUtilization = totalCars > 0 ? Math.round((activeCars / totalCars) * 100) : 0;

    // Build expiry alerts — docs expiring within 30 days
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiryAlerts = [];
    for (const car of allCarsForExpiry) {
      for (const [key, label] of [['rc','RC'], ['insurance','Insurance'], ['puc','PUC Certificate'], ['fitness','Fitness Certificate'], ['roadTax','Road Tax']]) {
        const expiry = car.documents?.[key]?.expiry;
        if (!expiry) continue;
        const exp = new Date(expiry);
        if (exp <= in30) {
          const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
          expiryAlerts.push({
            carId: car._id,
            car: car.name,
            plate: car.registrationNo,
            doc: label,
            expiry: exp.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            daysLeft,
            level: daysLeft <= 7 ? 'critical' : daysLeft <= 15 ? 'warning' : 'ok',
          });
        }
      }
    }
    expiryAlerts.sort((a, b) => a.daysLeft - b.daysLeft);

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
        recentBookings: recentBookings.map(b => ({
          id: b._id,
          bookingId: b.bookingId,
          customer: b.userId?.name || 'Guest',
          car: b.carId?.name || 'N/A',
          city: b.cityId?.name || 'N/A',
          amount: b.amountPaid || 0,
          status: b.status,
          createdAt: b.createdAt,
        })),
        expiryAlerts: expiryAlerts.slice(0, 5),
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

// GET /api/admin/dashboard/sidebar-counts  — lightweight, called every 60s by sidebar
const getSidebarCounts = async (req, res) => {
  try {
    const [
      pendingBookings,
      pendingKyc,
      newContacts,
      totalCars,
    ] = await Promise.all([
      Booking.countDocuments({ status: 'confirmed' }),
      User.countDocuments({ kycStatus: 'pending' }),
      ContactRequest.countDocuments({ status: 'new' }),
      Car.countDocuments({}),
    ]);

    return res.json({
      success: true,
      data: { pendingBookings, pendingKyc, newContacts, totalCars },
    });
  } catch (error) {
    return res.status(500).json({ success: false });
  }
};

module.exports = { getDashboardStats, getDashboardInsights, getSidebarCounts };

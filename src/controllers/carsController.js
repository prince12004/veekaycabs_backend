const Car = require('../models/Car');
const Booking = require('../models/Booking');
const City = require('../models/City');

// GET /api/cars/available
const getAvailableCars = async (req, res) => {
  try {
    const { city, startTime, endTime, type, fuel, transmission, seats, page, limit } = req.query;

    if (!city || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'city, startTime and endTime are required',
      });
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || start >= end) {
      return res.status(400).json({ success: false, message: 'Invalid date range' });
    }

    // Resolve city slug to id
    let cityDoc;
    if (city.match(/^[0-9a-fA-F]{24}$/)) {
      cityDoc = await City.findById(city);
    } else {
      cityDoc = await City.findOne({ slug: city.toLowerCase(), isActive: true });
    }
    if (!cityDoc) {
      return res.status(404).json({ success: false, message: 'City not found' });
    }

    // Build car filter
    const carFilter = { cityId: cityDoc._id, isActive: true };
    if (type) carFilter.type = type;
    if (fuel) carFilter.fuel = fuel;
    if (transmission) carFilter.transmission = transmission;
    if (seats) carFilter.seats = parseInt(seats);

    const allCars = await Car.find(carFilter).populate('cityId', 'name slug deliveryCharge');

    const carIds = allCars.map((c) => c._id);

    // Find overlapping bookings
    const overlappingBookings = await Booking.find({
      carId: { $in: carIds },
      status: { $in: ['confirmed', 'active'] },
      $or: [{ startTime: { $lt: end }, endTime: { $gt: start } }],
    }).select('carId');

    const bookedCarIds = new Set(overlappingBookings.map((b) => b.carId.toString()));

    // Compute pricing for this booking period
    const hours = Math.ceil((end - start) / (1000 * 60 * 60));
    const isWeekend = [0, 6].includes(start.getDay());

    const carsWithPricing = allCars.map((car) => {
      const rate = isWeekend ? car.weekendPrice : car.regularPrice;
      const bookingFare = hours * rate;
      const gst = Math.round(bookingFare * 0.18);
      return {
        ...car.toObject(),
        isAvailable: !bookedCarIds.has(car._id.toString()),
        computedFare: {
          hours,
          ratePerHour: rate,
          bookingFare,
          gst,
          securityDeposit: car.securityDeposit,
          estimatedTotal: bookingFare + gst + car.securityDeposit,
        },
      };
    });

    // Available cars first, sold-out cars pushed to the end
    carsWithPricing.sort((a, b) => (a.isAvailable === b.isAvailable ? 0 : a.isAvailable ? -1 : 1));

    // Pagination is opt-in: only slice the results if a caller explicitly
    // asks for a page/limit. The frontend search has no pagination UI and
    // expects the full list, so it must not be silently capped.
    let paginated = carsWithPricing;
    let pageNum = 1;
    let pageSize = carsWithPricing.length;
    if (page || limit) {
      pageNum = parseInt(page) || 1;
      pageSize = parseInt(limit) || carsWithPricing.length;
      const skip = (pageNum - 1) * pageSize;
      paginated = carsWithPricing.slice(skip, skip + pageSize);
    }

    return res.json({
      success: true,
      data: paginated,
      total: carsWithPricing.length,
      page: pageNum,
      pages: pageSize > 0 ? Math.ceil(carsWithPricing.length / pageSize) : 1,
    });
  } catch (error) {
    console.error('getAvailableCars error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch available cars' });
  }
};

// GET /api/cars/popular
const getPopularCars = async (req, res) => {
  try {
    const { city, limit = 6, startTime, endTime } = req.query;

    let cityFilter = {};
    if (city) {
      let cityDoc;
      if (city.match(/^[0-9a-fA-F]{24}$/)) {
        cityDoc = await City.findById(city);
      } else {
        cityDoc = await City.findOne({ slug: city.toLowerCase() });
      }
      if (cityDoc) cityFilter = { cityId: cityDoc._id };
    }

    // Aggregate bookings to find most booked cars
    const popularCarIds = await Booking.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed', 'active'] } } },
      { $group: { _id: '$carId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) * 3 },
    ]);

    const orderedIds = popularCarIds.map((p) => p._id);

    const cars = await Car.find({
      _id: { $in: orderedIds },
      isActive: true,
      ...cityFilter,
    })
      .populate('cityId', 'name slug')
      .limit(parseInt(limit));

    // Sort by popularity order
    const sorted = orderedIds
      .map((id) => cars.find((c) => c._id.toString() === id.toString()))
      .filter(Boolean);

    // If fewer than requested, fill with latest active cars
    if (sorted.length < parseInt(limit)) {
      const existing = sorted.map((c) => c._id.toString());
      const extras = await Car.find({
        _id: { $nin: existing },
        isActive: true,
        ...cityFilter,
      })
        .populate('cityId', 'name slug')
        .limit(parseInt(limit) - sorted.length)
        .sort({ createdAt: -1 });
      sorted.push(...extras);
    }

    let result = sorted.slice(0, parseInt(limit));

    // Availability check — a chosen date/time window if given, otherwise
    // "right now" so the homepage can flag cars that are currently out on rent.
    let start = startTime ? new Date(startTime) : null;
    let end = endTime ? new Date(endTime) : null;
    if (!start || !end || isNaN(start) || isNaN(end) || start >= end) {
      start = new Date();
      end = new Date();
    }
    const carIds = result.map((c) => c._id);
    const overlappingBookings = await Booking.find({
      carId: { $in: carIds },
      status: { $in: ['confirmed', 'active'] },
      $or: [{ startTime: { $lte: end }, endTime: { $gte: start } }],
    }).select('carId');
    const bookedCarIds = new Set(overlappingBookings.map((b) => b.carId.toString()));

    result = result
      .map((c) => ({ ...c.toObject(), isAvailable: !bookedCarIds.has(c._id.toString()) }))
      .sort((a, b) => (a.isAvailable === b.isAvailable ? 0 : a.isAvailable ? -1 : 1));

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('getPopularCars error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch popular cars' });
  }
};

// GET /api/cars/:id
const getCarById = async (req, res) => {
  try {
    const { id } = req.params;
    let car;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      car = await Car.findById(id).populate('cityId', 'name slug pickupLocations deliveryCharge');
    } else {
      car = await Car.findOne({ slug: id }).populate('cityId', 'name slug pickupLocations deliveryCharge');
    }
    if (!car || !car.isActive) {
      return res.status(404).json({ success: false, message: 'Car not found' });
    }
    return res.json({ success: true, data: car });
  } catch (error) {
    console.error('getCarById error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch car' });
  }
};

module.exports = { getAvailableCars, getPopularCars, getCarById };

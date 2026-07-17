const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../../middleware/adminAuth');
const Car = require('../../models/Car');
const Booking = require('../../models/Booking');
const { getLiveLocations, isConfigured, getAddress } = require('../../services/gps');

router.use(protectAdmin);

// A car counts as "online" if moving, "idle" if stationary but recently
// heard from, and "offline" if the device hasn't reported in a while.
const IDLE_THRESHOLD_MINUTES = 30;

// GET /api/admin/gps/live — live location/status for every car with a GPS device fitted
router.get('/live', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.json({ success: true, configured: false, data: [] });
    }

    const cars = await Car.find(
      { gpsDeviceId: { $nin: [null, ''] }, isDeleted: { $ne: true } },
      'name registrationNo gpsDeviceId'
    ).lean();

    if (cars.length === 0) {
      return res.json({ success: true, configured: true, data: [] });
    }

    const liveMap = await getLiveLocations(cars.map((c) => c.gpsDeviceId));

    const now = new Date();
    const activeBookings = await Booking.find(
      {
        carId: { $in: cars.map((c) => c._id) },
        status: { $in: ['confirmed', 'active'] },
        isDeleted: { $ne: true },
        startTime: { $lte: now },
        endTime: { $gte: now },
      },
      'carId endTime'
    ).populate('userId', 'name').lean();
    const bookingByCarId = new Map(activeBookings.map((b) => [String(b.carId), b]));

    const data = await Promise.all(cars.map(async (car) => {
      const device = liveMap.get(car.gpsDeviceId);
      const booking = bookingByCarId.get(String(car._id));
      const base = {
        carId: car._id,
        name: car.name,
        regNo: car.registrationNo,
        deviceId: car.gpsDeviceId,
        customer: booking?.userId?.name || 'Depot',
        bookingEnd: booking?.endTime || null,
      };

      if (!device) {
        return { ...base, status: 'offline', speed: 0, battery: null, ignition: null, lat: null, lng: null, lastUpdate: null, address: null };
      }

      const lastUpdateMs = new Date(device.lastStatusUpdate || device.fixTime).getTime();
      const minutesSinceUpdate = (Date.now() - lastUpdateMs) / 60000;
      const status = minutesSinceUpdate > IDLE_THRESHOLD_MINUTES
        ? 'offline'
        : device.attributes?.motion ? 'online' : 'idle';

      const lat = device.valid ? device.latitude : null;
      const lng = device.valid ? device.longitude : null;
      const address = device.address || (await getAddress(lat, lng));

      return {
        ...base,
        status,
        speed: device.speed || 0,
        battery: device.attributes?.batteryLevel ?? null,
        ignition: device.attributes?.ignition ?? null,
        lat,
        lng,
        lastUpdate: device.lastStatusUpdate,
        address,
      };
    }));

    return res.json({ success: true, configured: true, data });
  } catch (error) {
    console.error('admin gps live error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch GPS data' });
  }
});

module.exports = router;

require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis');
const cron = require('node-cron');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await connectRedis();

  // Cron: Every 30 min — mark overdue bookings as completed. Covers
  // 'confirmed' too, not just 'active' — a booking the admin never manually
  // marked active/closed used to sit as 'confirmed' forever, which kept
  // blocking that car's dates in the availability search long after the
  // rental period actually ended.
  cron.schedule('*/30 * * * *', async () => {
    try {
      const Booking = require('./models/Booking');
      const result = await Booking.updateMany(
        { status: { $in: ['confirmed', 'active'] }, endTime: { $lt: new Date() }, isDeleted: { $ne: true } },
        { status: 'completed' }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Cron] Completed ${result.modifiedCount} overdue booking(s)`);
      }
    } catch (err) {
      console.error('[Cron] Error updating overdue bookings:', err.message);
    }
  });

  // Cron: Daily at midnight — expire pending bookings older than 1 hour
  cron.schedule('0 0 * * *', async () => {
    try {
      const Booking = require('./models/Booking');
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await Booking.updateMany(
        { status: 'pending', createdAt: { $lt: oneHourAgo }, isDeleted: { $ne: true } },
        { status: 'cancelled', cancellationReason: 'Payment not received' }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Cron] Expired ${result.modifiedCount} unpaid booking(s)`);
      }
    } catch (err) {
      console.error('[Cron] Error expiring pending bookings:', err.message);
    }
  });

  // Cron: Every 1 min — apply scheduled car inactive/active windows set via
  // the admin "Deactivate Car" modal (inactivePeriod.from/to on the Car model)
  cron.schedule('* * * * *', async () => {
    try {
      const Car = require('./models/Car');
      const now = new Date();

      const wentInactive = await Car.updateMany(
        { isActive: true, isDeleted: { $ne: true }, 'inactivePeriod.from': { $lte: now } },
        { $set: { isActive: false } }
      );
      const wentActive = await Car.updateMany(
        { isActive: false, isDeleted: { $ne: true }, 'inactivePeriod.to': { $lt: now } },
        { $set: { isActive: true }, $unset: { inactivePeriod: 1 } }
      );

      if (wentInactive.modifiedCount > 0 || wentActive.modifiedCount > 0) {
        console.log(`[Cron] Cars auto-deactivated: ${wentInactive.modifiedCount}, auto-reactivated: ${wentActive.modifiedCount}`);
      }
    } catch (err) {
      console.error('[Cron] Error applying scheduled car status:', err.message);
    }
  });

  // Cron: Every 15 min — send WhatsApp pickup reminder ~2h before startTime
  cron.schedule('*/15 * * * *', async () => {
    try {
      const Booking = require('./models/Booking');
      const { sendPickupReminder } = require('./services/whatsapp');
      const now = new Date();
      const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const dueBookings = await Booking.find({
        status: 'confirmed',
        pickupReminderSent: false,
        isDeleted: { $ne: true },
        startTime: { $gte: now, $lte: windowEnd },
      })
        .populate('userId', 'name mobile')
        .populate('carId', 'name');

      for (const booking of dueBookings) {
        const mobile = booking.userId?.mobile;
        if (mobile && !String(mobile).startsWith('google_')) {
          await sendPickupReminder(booking.userId, booking, booking.carId);
        }
        booking.pickupReminderSent = true;
        await booking.save();
      }
      if (dueBookings.length > 0) {
        console.log(`[Cron] Sent ${dueBookings.length} pickup reminder(s)`);
      }
    } catch (err) {
      console.error('[Cron] Error sending pickup reminders:', err.message);
    }
  });

  // Seed initial cities if none exist
  const City = require('./models/City');
  const cityCount = await City.countDocuments();
  if (cityCount === 0) {
    await City.insertMany([
      {
        name: 'Delhi',
        slug: 'delhi',
        pickupLocations: [
          { name: 'Delhi Office', address: 'A 13, 1st Floor, Ganesh Nagar, New Delhi 110092' },
        ],
      },
      {
        name: 'Noida',
        slug: 'noida',
        pickupLocations: [{ name: 'Noida Office', address: 'Sector 18, Noida, UP' }],
      },
      {
        name: 'Gurgaon',
        slug: 'gurgaon',
        pickupLocations: [{ name: 'Gurgaon Office', address: 'DLF Cyber City, Gurgaon, Haryana' }],
      },
      { name: 'Ghaziabad', slug: 'ghaziabad', pickupLocations: [] },
      { name: 'Greater Noida', slug: 'greater-noida', pickupLocations: [] },
    ]);
    console.log('[Seed] 5 cities created');
  }

  app.listen(PORT, () => {
    console.log(`\nVeekay Cabs Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`Health: http://localhost:${PORT}/health`);
    const smsKey = process.env.YOURBULKSMS_AUTH_KEY || '';
    console.log(`SMS: ${smsKey && smsKey !== 'placeholder' ? `✓ key=${smsKey.slice(0,6)}... (${smsKey.length} chars)` : '✗ NOT configured'}\n`);
  });
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

startServer();

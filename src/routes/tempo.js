const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getAvailableTempos,
  getTempoBySlug,
  createTempoBooking,
  getMyTempoBookings,
  getTempoBookingById,
  cancelTempoBooking,
} = require('../controllers/tempoController');
const { getSeoPageBySlug } = require('../controllers/admin/adminTempoSeoController');

router.get('/available', getAvailableTempos);
router.get('/seo/:slug', getSeoPageBySlug);
router.get('/:slug', getTempoBySlug);

// Protected (user must be logged in)
router.post('/bookings', protect, createTempoBooking);
router.get('/bookings/my', protect, getMyTempoBookings);
router.get('/bookings/:id', protect, getTempoBookingById);
router.post('/bookings/:id/cancel', protect, cancelTempoBooking);

module.exports = router;

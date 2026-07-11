const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBookingById,
  extendBooking,
  cancelBooking,
  getMyBookingMedia,
} = require('../controllers/bookingsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/create', createBooking);
router.get('/my', getMyBookings);
router.get('/:id', getBookingById);
router.get('/:id/media', getMyBookingMedia);
router.post('/:id/extend', extendBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;

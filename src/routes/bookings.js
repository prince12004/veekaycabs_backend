const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getBookingById,
  extendBooking,
  cancelBooking,
} = require('../controllers/bookingsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/create', createBooking);
router.get('/my', getMyBookings);
router.get('/:id', getBookingById);
router.post('/:id/extend', extendBooking);
router.post('/:id/cancel', cancelBooking);

module.exports = router;

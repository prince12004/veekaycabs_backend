const express = require('express');
const router = express.Router();
const {
  getAllBookings,
  getBookingDetail,
  createOfflineBooking,
  exportBookings,
} = require('../../controllers/admin/adminBookingsController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/export', exportBookings);
router.get('/', getAllBookings);
router.post('/offline', createOfflineBooking);
router.get('/:id', getBookingDetail);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const {
  getAllTempoBookings,
  getTempoBookingById,
  createOfflineTempoBooking,
  updateTempoBooking,
  deleteTempoBooking,
  markCarReceived,
} = require('../../controllers/admin/adminTempoBookingsController');

router.use(protectAdmin);

router.get('/', getAllTempoBookings);
router.get('/:id', getTempoBookingById);
router.post('/offline', createOfflineTempoBooking);
router.put('/:id', updateTempoBooking);
router.delete('/:id', requirePermission('tempoAdmin', 'delete'), deleteTempoBooking);
router.patch('/:id/car-received', markCarReceived);

module.exports = router;

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
router.post('/offline', requirePermission('tempoAdmin', 'add'), createOfflineTempoBooking);
router.put('/:id', requirePermission('tempoAdmin', 'edit'), updateTempoBooking);
router.delete('/:id', requirePermission('tempoAdmin', 'delete'), deleteTempoBooking);
router.patch('/:id/car-received', requirePermission('tempoAdmin', 'edit'), markCarReceived);

module.exports = router;

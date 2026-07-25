const express = require('express');
const router = express.Router();
const { getRevenueReport, getBookingStats, getCarRevenueReport, getSettlementsReport } = require('../../controllers/admin/adminReportsController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/revenue', getRevenueReport);
router.get('/bookings', getBookingStats);
router.get('/car-revenue', getCarRevenueReport);
router.get('/settlements', getSettlementsReport);

module.exports = router;

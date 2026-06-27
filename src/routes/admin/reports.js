const express = require('express');
const router = express.Router();
const { getRevenueReport, getBookingStats } = require('../../controllers/admin/adminReportsController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/revenue', getRevenueReport);
router.get('/bookings', getBookingStats);

module.exports = router;

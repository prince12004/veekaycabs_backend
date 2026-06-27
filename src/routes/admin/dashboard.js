const express = require('express');
const router = express.Router();
const { getDashboardStats, getDashboardInsights } = require('../../controllers/admin/dashboardController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/stats', getDashboardStats);
router.get('/insights', getDashboardInsights);

module.exports = router;

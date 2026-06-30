const express = require('express');
const router = express.Router();
const { getDashboardStats, getDashboardInsights, getSidebarCounts } = require('../../controllers/admin/dashboardController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/stats', getDashboardStats);
router.get('/insights', getDashboardInsights);
router.get('/sidebar-counts', getSidebarCounts);

module.exports = router;

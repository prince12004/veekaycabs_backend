const express = require('express');
const router = express.Router();
const { verifyRcStandalone, checkChallanStandalone, listVehicleChecks } = require('../../controllers/admin/adminVehicleVerificationController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', listVehicleChecks);
router.post('/rc', requirePermission('vehicleVerification', 'edit'), verifyRcStandalone);
router.post('/challan', requirePermission('vehicleVerification', 'edit'), checkChallanStandalone);

module.exports = router;

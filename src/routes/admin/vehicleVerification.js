const express = require('express');
const router = express.Router();
const { verifyRcStandalone, checkChallanStandalone, listVehicleChecks } = require('../../controllers/admin/adminVehicleVerificationController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', listVehicleChecks);
router.post('/rc', verifyRcStandalone);
router.post('/challan', checkChallanStandalone);

module.exports = router;

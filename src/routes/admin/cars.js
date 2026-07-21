const express = require('express');
const router = express.Router();
const {
  getAllCars,
  getCarStats,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  toggleCarStatus,
  getExpiryAlerts,
  uploadCarDocument,
} = require('../../controllers/admin/adminCarsController');
const { verifyCarRC, checkCarChallan } = require('../../controllers/admin/adminVehicleVerificationController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');

router.use(protectAdmin);

router.get('/expiry-alerts', getExpiryAlerts);
router.get('/stats', getCarStats);
router.get('/', getAllCars);
router.get('/:id', getCarById);
router.post('/', requirePermission('addCar', 'view'), getUploader('cars').array('images', 10), createCar);
router.put('/:id', requirePermission('carListing', 'edit'), getUploader('cars').array('images', 10), updateCar);
router.delete('/:id', requirePermission('carListing', 'delete'), deleteCar);
router.patch('/:id/toggle', requirePermission('carListing', 'edit'), toggleCarStatus);
router.patch('/:id/documents/:docType', requirePermission('carDocuments', 'edit'), getUploader('car-docs').single('file'), uploadCarDocument);
router.post('/:id/verify-rc', requirePermission('vehicleVerification', 'edit'), verifyCarRC);
router.post('/:id/check-challan', requirePermission('vehicleVerification', 'edit'), checkCarChallan);

module.exports = router;

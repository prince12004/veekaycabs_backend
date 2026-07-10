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
const { protectAdmin } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');

router.use(protectAdmin);

router.get('/expiry-alerts', getExpiryAlerts);
router.get('/stats', getCarStats);
router.get('/', getAllCars);
router.get('/:id', getCarById);
router.post('/', getUploader('cars').array('images', 10), createCar);
router.put('/:id', getUploader('cars').array('images', 10), updateCar);
router.delete('/:id', deleteCar);
router.patch('/:id/toggle', toggleCarStatus);
router.patch('/:id/documents/:docType', getUploader('car-docs').single('file'), uploadCarDocument);
router.post('/:id/verify-rc', verifyCarRC);
router.post('/:id/check-challan', checkCarChallan);

module.exports = router;

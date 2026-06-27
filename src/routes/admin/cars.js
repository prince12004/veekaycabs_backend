const express = require('express');
const router = express.Router();
const {
  getAllCars,
  createCar,
  updateCar,
  deleteCar,
  toggleCarStatus,
  getExpiryAlerts,
} = require('../../controllers/admin/adminCarsController');
const { protectAdmin } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');

router.use(protectAdmin);

router.get('/expiry-alerts', getExpiryAlerts);
router.get('/', getAllCars);
router.post('/', getUploader('cars').array('images', 10), createCar);
router.put('/:id', getUploader('cars').array('images', 10), updateCar);
router.delete('/:id', deleteCar);
router.patch('/:id/toggle', toggleCarStatus);

module.exports = router;

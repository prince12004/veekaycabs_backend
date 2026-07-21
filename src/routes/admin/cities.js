const express = require('express');
const router = express.Router();
const { getAllCities, createCity, updateCity, deleteCity } = require('../../controllers/admin/adminCitiesController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', getAllCities);
router.post('/', requirePermission('cities', 'add'), createCity);
router.put('/:id', requirePermission('cities', 'edit'), updateCity);
router.delete('/:id', requirePermission('cities', 'delete'), deleteCity);

module.exports = router;

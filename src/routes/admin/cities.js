const express = require('express');
const router = express.Router();
const { getAllCities, createCity, updateCity, deleteCity } = require('../../controllers/admin/adminCitiesController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', getAllCities);
router.post('/', createCity);
router.put('/:id', updateCity);
router.delete('/:id', deleteCity);

module.exports = router;

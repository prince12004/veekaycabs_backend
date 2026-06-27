const express = require('express');
const router = express.Router();
const { getAvailableCars, getPopularCars, getCarById } = require('../controllers/carsController');

router.get('/available', getAvailableCars);
router.get('/popular', getPopularCars);
router.get('/:id', getCarById);

module.exports = router;

const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { getMyFavorites, toggleFavorite } = require('../controllers/favoritesController');

router.get('/my', protect, getMyFavorites);
router.post('/toggle', protect, toggleFavorite);

module.exports = router;

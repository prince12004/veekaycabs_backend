const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, uploadProfilePhoto, addMobile } = require('../controllers/usersController');
const { protect } = require('../middleware/auth');
const { getUploader } = require('../middleware/upload');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/upload-photo', getUploader('profile').single('photo'), uploadProfilePhoto);
router.post('/add-mobile', addMobile);

module.exports = router;

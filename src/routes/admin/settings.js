const router = require('express').Router();
const { protectAdmin } = require('../../middleware/adminAuth');
const { getSettings, updateSettings } = require('../../controllers/admin/adminSettingsController');

router.use(protectAdmin);
router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;

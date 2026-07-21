const router = require('express').Router();
const { protectAdmin, requireAnyPermission } = require('../../middleware/adminAuth');
const { getSettings, updateSettings } = require('../../controllers/admin/adminSettingsController');

router.use(protectAdmin);
router.get('/', getSettings);
// Basic Details and Social Media are two sidebar pages sharing this one
// settings document/endpoint — either edit permission unlocks the save.
router.put('/', requireAnyPermission([['basicDetails', 'edit'], ['socialMedia', 'edit']]), updateSettings);

module.exports = router;

const router = require('express').Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getPage, getAllPages, upsertPage } = require('../../controllers/admin/adminPolicyController');

router.use(protectAdmin);
router.get('/', getAllPages);
router.get('/:key', getPage);
router.put('/:key', requirePermission('policyPages', 'edit'), upsertPage);

module.exports = router;

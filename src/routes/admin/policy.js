const router = require('express').Router();
const { protectAdmin } = require('../../middleware/adminAuth');
const { getPage, getAllPages, upsertPage } = require('../../controllers/admin/adminPolicyController');

router.use(protectAdmin);
router.get('/', getAllPages);
router.get('/:key', getPage);
router.put('/:key', upsertPage);

module.exports = router;

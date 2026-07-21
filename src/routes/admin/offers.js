const router = require('express').Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');
const { getAll, create, update, remove } = require('../../controllers/admin/adminOfferController');

const upload = getUploader('offers');
router.use(protectAdmin);
router.get('/', getAll);
router.post('/', requirePermission('offers', 'add'), upload.single('image'), create);
router.put('/:id', requirePermission('offers', 'edit'), upload.single('image'), update);
router.delete('/:id', requirePermission('offers', 'delete'), remove);

module.exports = router;

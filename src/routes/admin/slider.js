const router = require('express').Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');
const { getAll, create, update, remove } = require('../../controllers/admin/adminSliderController');

const upload = getUploader('slider');
router.use(protectAdmin);
router.get('/', getAll);
router.post('/', requirePermission('slider', 'add'), upload.single('image'), create);
router.put('/:id', requirePermission('slider', 'edit'), upload.single('image'), update);
router.delete('/:id', requirePermission('slider', 'delete'), remove);

module.exports = router;

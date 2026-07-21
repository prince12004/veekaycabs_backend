const router = require('express').Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');
const { getAll, create, update, remove } = require('../../controllers/admin/adminTestimonialController');

const upload = getUploader('testimonials');
router.use(protectAdmin);
router.get('/', getAll);
router.post('/', requirePermission('testimonials', 'add'), upload.single('avatar'), create);
router.put('/:id', requirePermission('testimonials', 'edit'), upload.single('avatar'), update);
router.delete('/:id', requirePermission('testimonials', 'delete'), remove);

module.exports = router;

const router = require('express').Router();
const { protectAdmin } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');
const { getAll, create, update, remove } = require('../../controllers/admin/adminTestimonialController');

const upload = getUploader('testimonials');
router.use(protectAdmin);
router.get('/', getAll);
router.post('/', upload.single('avatar'), create);
router.put('/:id', upload.single('avatar'), update);
router.delete('/:id', remove);

module.exports = router;

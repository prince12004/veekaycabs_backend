const router = require('express').Router();
const { protectAdmin } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');
const { getAll, create, update, remove } = require('../../controllers/admin/adminSliderController');

const upload = getUploader('slider');
router.use(protectAdmin);
router.get('/', getAll);
router.post('/', upload.single('image'), create);
router.put('/:id', upload.single('image'), update);
router.delete('/:id', remove);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getAll, getTotalsByCar, create, update, remove } = require('../../controllers/admin/adminMaintenanceController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/by-car', getTotalsByCar);
router.get('/', getAll);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;

const express = require('express');
const router = express.Router();
const { getAll, getTotalsByCar, create, update, remove } = require('../../controllers/admin/adminMaintenanceController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/by-car', getTotalsByCar);
router.get('/', getAll);
router.post('/', requirePermission('carMaintenance', 'add'), create);
router.put('/:id', requirePermission('carMaintenance', 'edit'), update);
router.delete('/:id', requirePermission('carMaintenance', 'delete'), remove);

module.exports = router;

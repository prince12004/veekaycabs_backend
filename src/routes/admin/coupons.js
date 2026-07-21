const express = require('express');
const router = express.Router();
const {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCoupon,
} = require('../../controllers/admin/adminCouponsController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', getAllCoupons);
router.post('/', requirePermission('coupons', 'add'), createCoupon);
router.put('/:id', requirePermission('coupons', 'edit'), updateCoupon);
router.delete('/:id', requirePermission('coupons', 'delete'), deleteCoupon);
router.patch('/:id/toggle', requirePermission('coupons', 'edit'), toggleCoupon);

module.exports = router;

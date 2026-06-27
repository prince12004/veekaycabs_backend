const express = require('express');
const router = express.Router();
const {
  getAllCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  toggleCoupon,
} = require('../../controllers/admin/adminCouponsController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', getAllCoupons);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.patch('/:id/toggle', toggleCoupon);

module.exports = router;

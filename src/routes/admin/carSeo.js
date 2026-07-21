const express = require('express');
const router = express.Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const {
  getAllSeoPages,
  getSeoPageById,
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
} = require('../../controllers/admin/adminCarSeoController');

router.use(protectAdmin);

router.get('/', getAllSeoPages);
router.get('/:id', getSeoPageById);
router.post('/', requirePermission('seoPages', 'add'), createSeoPage);
router.put('/:id', requirePermission('seoPages', 'edit'), updateSeoPage);
router.delete('/:id', requirePermission('seoPages', 'delete'), deleteSeoPage);

module.exports = router;

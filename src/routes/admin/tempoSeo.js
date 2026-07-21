const express = require('express');
const router = express.Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const {
  getAllSeoPages,
  getSeoPageById,
  createSeoPage,
  updateSeoPage,
  deleteSeoPage,
} = require('../../controllers/admin/adminTempoSeoController');

router.use(protectAdmin);

router.get('/', getAllSeoPages);
router.get('/:id', getSeoPageById);
router.post('/', requirePermission('tempoAdmin', 'add'), createSeoPage);
router.put('/:id', requirePermission('tempoAdmin', 'edit'), updateSeoPage);
router.delete('/:id', requirePermission('tempoAdmin', 'delete'), deleteSeoPage);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../../middleware/adminAuth');
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
router.post('/', createSeoPage);
router.put('/:id', updateSeoPage);
router.delete('/:id', deleteSeoPage);

module.exports = router;

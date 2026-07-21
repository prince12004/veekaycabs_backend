const express = require('express');
const router = express.Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');
const {
  getAllTempos,
  getTempoById,
  createTempo,
  updateTempo,
  deleteTempo,
  toggleTempoStatus,
} = require('../../controllers/admin/adminTempoController');

router.use(protectAdmin);

router.get('/', getAllTempos);
router.get('/:id', getTempoById);
router.post('/', requirePermission('tempoAdmin', 'add'), getUploader('tempos').array('images', 10), createTempo);
router.put('/:id', requirePermission('tempoAdmin', 'edit'), getUploader('tempos').array('images', 10), updateTempo);
router.delete('/:id', requirePermission('tempoAdmin', 'delete'), deleteTempo);
router.patch('/:id/toggle', requirePermission('tempoAdmin', 'edit'), toggleTempoStatus);

module.exports = router;

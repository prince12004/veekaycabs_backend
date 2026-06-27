const express = require('express');
const router = express.Router();
const { protectAdmin } = require('../../middleware/adminAuth');
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
router.post('/', getUploader('tempos').array('images', 10), createTempo);
router.put('/:id', getUploader('tempos').array('images', 10), updateTempo);
router.delete('/:id', deleteTempo);
router.patch('/:id/toggle', toggleTempoStatus);

module.exports = router;

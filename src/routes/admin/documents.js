const express = require('express');
const router = express.Router();
const { getPendingDocuments, reviewDocuments } = require('../../controllers/admin/adminDocumentsController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', getPendingDocuments);
router.patch('/:userId', reviewDocuments);

module.exports = router;

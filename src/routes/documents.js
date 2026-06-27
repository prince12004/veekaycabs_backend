const express = require('express');
const router = express.Router();
const { getMyDocuments, uploadDocument, submitDocuments } = require('../controllers/documentsController');
const { protect } = require('../middleware/auth');
const { getUploader } = require('../middleware/upload');

router.use(protect);

router.get('/my', getMyDocuments);
router.post('/upload', getUploader('kyc').single('file'), uploadDocument);
router.patch('/submit', submitDocuments);

module.exports = router;

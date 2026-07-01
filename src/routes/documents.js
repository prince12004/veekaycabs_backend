const express = require('express');
const router = express.Router();
const { getMyDocuments, uploadDocument, submitDocuments } = require('../controllers/documentsController');
const { sendAadhaarOtp, verifyAadhaarOtp, verifyPanNumber, verifyDLNumber } = require('../controllers/documentsVerificationController');
const { protect } = require('../middleware/auth');
const { getUploader } = require('../middleware/upload');

router.use(protect);

router.get('/my', getMyDocuments);
router.post('/upload', getUploader('kyc').single('file'), uploadDocument);
router.patch('/submit', submitDocuments);

router.post('/aadhaar/send-otp', sendAadhaarOtp);
router.post('/aadhaar/verify-otp', verifyAadhaarOtp);
router.post('/pan/verify', verifyPanNumber);
router.post('/dl/verify', verifyDLNumber);

module.exports = router;

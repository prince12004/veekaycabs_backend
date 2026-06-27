const UserDocument = require('../models/UserDocument');
const User = require('../models/User');
const { sendEmail } = require('../services/email');

// GET /api/documents/my
const getMyDocuments = async (req, res) => {
  try {
    let docs = await UserDocument.findOne({ userId: req.user._id });
    if (!docs) {
      docs = await UserDocument.create({ userId: req.user._id });
    }
    return res.json({ success: true, data: docs });
  } catch (error) {
    console.error('getMyDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};

// POST /api/documents/upload
const uploadDocument = async (req, res) => {
  try {
    const { docType, side } = req.body; // docType: aadhaar|pan|dl, side: front|back|photo
    if (!docType || !['aadhaar', 'pan', 'dl'].includes(docType)) {
      return res.status(400).json({ success: false, message: 'Invalid docType' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Determine file URL (S3 gives location, disk gives path)
    const fileUrl = file.location || `/uploads/${file.filename}`;

    let docs = await UserDocument.findOne({ userId: req.user._id });
    if (!docs) {
      docs = new UserDocument({ userId: req.user._id });
    }

    const fieldMap = {
      aadhaar: { front: 'aadhaar.front', back: 'aadhaar.back' },
      pan: { photo: 'pan.photo' },
      dl: { front: 'dl.front', back: 'dl.back' },
    };

    if (docType === 'aadhaar') {
      if (side === 'front') docs.aadhaar.front = fileUrl;
      else if (side === 'back') docs.aadhaar.back = fileUrl;
      if (docs.aadhaar.status === 'not_uploaded') docs.aadhaar.status = 'pending';
    } else if (docType === 'pan') {
      docs.pan.photo = fileUrl;
      if (docs.pan.status === 'not_uploaded') docs.pan.status = 'pending';
    } else if (docType === 'dl') {
      if (side === 'front') docs.dl.front = fileUrl;
      else if (side === 'back') docs.dl.back = fileUrl;
      if (docs.dl.status === 'not_uploaded') docs.dl.status = 'pending';
    }

    await docs.save();

    return res.json({ success: true, data: docs, fileUrl });
  } catch (error) {
    console.error('uploadDocument error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// PATCH /api/documents/submit
const submitDocuments = async (req, res) => {
  try {
    const docs = await UserDocument.findOne({ userId: req.user._id });
    if (!docs) {
      return res.status(404).json({ success: false, message: 'No documents found' });
    }

    // Validate minimum docs uploaded
    const hasAadhaar = docs.aadhaar?.front && docs.aadhaar?.back;
    const hasDL = docs.dl?.front;
    if (!hasAadhaar || !hasDL) {
      return res.status(400).json({
        success: false,
        message: 'Please upload Aadhaar (front & back) and Driving License before submitting',
      });
    }

    // Update all pending statuses to pending if not already verified
    if (docs.aadhaar?.front && docs.aadhaar.status === 'not_uploaded') docs.aadhaar.status = 'pending';
    if (docs.pan?.photo && docs.pan.status === 'not_uploaded') docs.pan.status = 'pending';
    if (docs.dl?.front && docs.dl.status === 'not_uploaded') docs.dl.status = 'pending';

    await docs.save();

    // Update user kycStatus
    await User.findByIdAndUpdate(req.user._id, { kycStatus: 'pending' });

    // Notify admin
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `KYC Submission - User ${req.user.mobile}`,
        html: `<p>User ${req.user.name} (${req.user.mobile}) has submitted KYC documents for review.</p>`,
      });
    }

    return res.json({
      success: true,
      message: 'Documents submitted for verification. We will review within 24 hours.',
    });
  } catch (error) {
    console.error('submitDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit documents' });
  }
};

module.exports = { getMyDocuments, uploadDocument, submitDocuments };

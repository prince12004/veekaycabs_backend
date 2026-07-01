const UserDocument = require('../../models/UserDocument');
const User = require('../../models/User');
const { sendEmail } = require('../../services/email');

// GET /api/admin/documents
const getPendingDocuments = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    // "all" → return every record; otherwise filter by status
    const filter = status === 'all' ? {} : {
      $or: [
        { 'aadhaar.status': status },
        { 'pan.status': status },
        { 'dl.status': status },
      ],
    };

    const [total, docs] = await Promise.all([
      UserDocument.countDocuments(filter),
      UserDocument.find(filter)
        .populate('userId', 'name mobile email kycStatus')
        .sort({ updatedAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

    return res.json({
      success: true,
      data: docs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('admin getPendingDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};

// PATCH /api/admin/documents/:userId
const reviewDocuments = async (req, res) => {
  try {
    const { decisions } = req.body;
    // decisions: { aadhaar: 'verified'|'rejected', pan: 'verified'|'rejected', dl: 'verified'|'rejected' }
    // with optional rejectedReason per doc

    if (!decisions) {
      return res.status(400).json({ success: false, message: 'decisions object required' });
    }

    const docs = await UserDocument.findOne({ userId: req.params.userId });
    if (!docs) return res.status(404).json({ success: false, message: 'Documents not found' });

    const validStatuses = ['verified', 'rejected', 'mismatch', 'expired'];
    const docTypes = ['aadhaar', 'pan', 'dl'];

    docTypes.forEach((docType) => {
      if (decisions[docType] && validStatuses.includes(decisions[docType].status)) {
        docs[docType].status = decisions[docType].status;
        if (decisions[docType].status === 'verified') {
          docs[docType].verifiedAt = new Date();
          docs[docType].rejectedReason = undefined;
        } else {
          docs[docType].rejectedReason = decisions[docType].reason || 'Document not clear';
        }
      }
    });

    await docs.save();

    // Determine overall KYC status
    const allVerified = docTypes.every((dt) => docs[dt]?.status === 'verified' || docs[dt]?.status === 'not_uploaded');
    const anyRejected = docTypes.some((dt) => ['rejected', 'mismatch', 'expired'].includes(docs[dt]?.status));
    const anyPending = docTypes.some((dt) => docs[dt]?.status === 'pending');

    let kycStatus = 'pending';
    if (allVerified && (docs.aadhaar?.status === 'verified' || docs.dl?.status === 'verified')) {
      kycStatus = 'verified';
    } else if (anyRejected && !anyPending) {
      kycStatus = 'rejected';
    }

    const user = await User.findByIdAndUpdate(req.params.userId, { kycStatus }, { new: true });

    // Notify user by email — fired without blocking the admin's response
    if (user?.email) {
      const emailSubject =
        kycStatus === 'verified'
          ? 'KYC Verified - You can now book cars on Veekay Cabs'
          : 'KYC Review Update - Veekay Cabs';
      const emailHtml =
        kycStatus === 'verified'
          ? `<h2>Congratulations ${user.name}!</h2><p>Your KYC documents have been verified. You can now book cars on Veekay Cabs.</p>`
          : `<h2>Hi ${user.name},</h2><p>Some of your KYC documents need attention. Please re-upload the rejected documents and submit again.</p>`;

      sendEmail({ to: user.email, subject: emailSubject, html: emailHtml }).catch(() => {});
    }

    return res.json({ success: true, data: docs, kycStatus, message: 'Documents reviewed successfully' });
  } catch (error) {
    console.error('admin reviewDocuments error:', error);
    return res.status(500).json({ success: false, message: 'Failed to review documents' });
  }
};

module.exports = { getPendingDocuments, reviewDocuments };

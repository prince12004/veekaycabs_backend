const UserDocument = require('../models/UserDocument');
const User = require('../models/User');
const {
  isQuickEkycConfigured,
  generateAadhaarOtp,
  submitAadhaarOtp,
  verifyPan,
  verifyDL,
} = require('../services/quickekyc');

// Once all three documents are instantly verified via QuickEKYC, there's
// nothing left for an admin to review — mark the user's overall KYC as
// verified right away instead of leaving it in the manual-review queue.
const maybeFinalizeKyc = async (userId, docs) => {
  const allVerified = ['aadhaar', 'pan', 'dl'].every((t) => docs[t]?.status === 'verified');
  if (allVerified) {
    await User.findByIdAndUpdate(userId, { kycStatus: 'verified' });
  }
};

// Flattens the Aadhaar OTP response's `address` object into a display string.
// QuickEKYC's docs only confirm `country` as a sub-field (the rest were
// truncated) — defensively check the common Indian-address keys and fall
// back gracefully if none are present.
const formatAddress = (addr) => {
  if (!addr || typeof addr !== 'object') return null;
  const parts = ['house', 'street', 'landmark', 'loc', 'vtc', 'po', 'subdist', 'district', 'state', 'pincode', 'pin_code', 'country']
    .map((k) => addr[k])
    .filter(Boolean);
  return parts.length ? parts.join(', ') : null;
};

const getOrCreateDocs = async (userId) => {
  let docs = await UserDocument.findOne({ userId });
  if (!docs) docs = new UserDocument({ userId });
  return docs;
};

// ─── POST /api/documents/aadhaar/send-otp ────────────────────────────────────
const sendAadhaarOtp = async (req, res) => {
  try {
    const aadhaarNumber = String(req.body?.aadhaarNumber || '').replace(/\D/g, '');
    if (aadhaarNumber.length !== 12) {
      return res.status(400).json({ success: false, message: 'Enter a valid 12-digit Aadhaar number' });
    }

    if (!isQuickEkycConfigured()) {
      return res.status(400).json({ success: false, message: 'Aadhaar verification not configured. Add QUICKEKYC_API_KEY in server .env.' });
    }

    const result = await generateAadhaarOtp(aadhaarNumber);
    if (!result.success) {
      return res.status(502).json({ success: false, message: result.error || 'Failed to send OTP' });
    }

    const docs = await getOrCreateDocs(req.user._id);
    docs.aadhaar.number = aadhaarNumber;
    docs.aadhaar.pendingRequestId = String(result.requestId);
    docs.aadhaar.otpSentAt = new Date();
    await docs.save();

    return res.json({ success: true, message: 'OTP sent to your Aadhaar-linked mobile number' });
  } catch (error) {
    console.error('sendAadhaarOtp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// ─── POST /api/documents/aadhaar/verify-otp ──────────────────────────────────
const verifyAadhaarOtp = async (req, res) => {
  try {
    const otp = String(req.body?.otp || '').trim();
    if (!otp) return res.status(400).json({ success: false, message: 'Enter the OTP' });

    const docs = await UserDocument.findOne({ userId: req.user._id });
    if (!docs?.aadhaar?.pendingRequestId) {
      return res.status(400).json({ success: false, message: 'Send OTP first' });
    }

    const result = await submitAadhaarOtp(docs.aadhaar.pendingRequestId, otp);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error || 'Invalid OTP' });
    }

    const d = result.data;
    docs.aadhaar.number = d.aadhaar_number || docs.aadhaar.number;
    docs.aadhaar.name = d.full_name || docs.aadhaar.name;
    docs.aadhaar.dob = d.dob || docs.aadhaar.dob;
    docs.aadhaar.address = formatAddress(d.address) || docs.aadhaar.address;
    docs.aadhaar.status = 'verified';
    docs.aadhaar.verifiedAt = new Date();
    docs.aadhaar.pendingRequestId = undefined;
    docs.aadhaar.otpSentAt = undefined;
    await docs.save();
    await maybeFinalizeKyc(req.user._id, docs);

    return res.json({ success: true, data: docs.aadhaar, message: 'Aadhaar verified successfully!' });
  } catch (error) {
    console.error('verifyAadhaarOtp error:', error);
    return res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// ─── POST /api/documents/pan/verify ──────────────────────────────────────────
const verifyPanNumber = async (req, res) => {
  try {
    const panNumber = String(req.body?.panNumber || '').trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panNumber)) {
      return res.status(400).json({ success: false, message: 'Enter a valid PAN number' });
    }

    if (!isQuickEkycConfigured()) {
      return res.status(400).json({ success: false, message: 'PAN verification not configured. Add QUICKEKYC_API_KEY in server .env.' });
    }

    const result = await verifyPan(panNumber);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error || 'PAN verification failed' });
    }

    const docs = await getOrCreateDocs(req.user._id);
    docs.pan.number = result.data.pan_number || panNumber;
    docs.pan.name = result.data.full_name || docs.pan.name;
    docs.pan.status = 'verified';
    docs.pan.verifiedAt = new Date();
    await docs.save();
    await maybeFinalizeKyc(req.user._id, docs);

    return res.json({ success: true, data: docs.pan, message: 'PAN verified successfully!' });
  } catch (error) {
    console.error('verifyPanNumber error:', error);
    return res.status(500).json({ success: false, message: 'PAN verification failed' });
  }
};

// ─── POST /api/documents/dl/verify ────────────────────────────────────────────
const verifyDLNumber = async (req, res) => {
  try {
    const licenseNumber = String(req.body?.licenseNumber || '').trim().toUpperCase();
    const dob = String(req.body?.dob || '').trim(); // YYYY-MM-DD
    if (!licenseNumber) {
      return res.status(400).json({ success: false, message: 'Enter your driving license number' });
    }

    if (!isQuickEkycConfigured()) {
      return res.status(400).json({ success: false, message: 'License verification not configured. Add QUICKEKYC_API_KEY in server .env.' });
    }

    const result = await verifyDL(licenseNumber, dob);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error || 'License verification failed' });
    }

    const docs = await getOrCreateDocs(req.user._id);
    docs.dl.number = result.data.license_number || licenseNumber;
    docs.dl.name = result.data.name || docs.dl.name;
    docs.dl.dob = dob || docs.dl.dob;
    docs.dl.status = 'verified';
    docs.dl.verifiedAt = new Date();
    await docs.save();
    await maybeFinalizeKyc(req.user._id, docs);

    return res.json({ success: true, data: docs.dl, message: 'Driving Licence verified successfully!' });
  } catch (error) {
    console.error('verifyDLNumber error:', error);
    return res.status(500).json({ success: false, message: 'License verification failed' });
  }
};

module.exports = { sendAadhaarOtp, verifyAadhaarOtp, verifyPanNumber, verifyDLNumber };

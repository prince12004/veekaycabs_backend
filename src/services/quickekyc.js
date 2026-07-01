const axios = require('axios');

// ─── QuickEKYC (quickekyc.com) client ────────────────────────────────────────
// RC Advance + Challan + Aadhaar/PAN/DL KYC. The API key goes inside the JSON
// body as `key` (NOT as a header). "RC Verification Special v1 API" on the
// dashboard = /rc/rc_advance in the Postman docs (confirmed).
const QUICKEKYC_BASE_URL = process.env.QUICKEKYC_BASE_URL || 'https://api.quickekyc.com/api/v1';

const isQuickEkycConfigured = () =>
  !!process.env.QUICKEKYC_API_KEY && process.env.QUICKEKYC_API_KEY !== 'placeholder';

const isSurepassConfigured = () =>
  !!process.env.SUREPASS_TOKEN && process.env.SUREPASS_TOKEN !== 'placeholder';

const isRcConfigured = () => isSurepassConfigured() || isQuickEkycConfigured();

const post = (path, body) =>
  axios.post(
    `${QUICKEKYC_BASE_URL}${path}`,
    { key: process.env.QUICKEKYC_API_KEY, ...body },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );

// Some QuickEKYC endpoints wrap `data` in an array (e.g. PAN Aadhaar Linked,
// PAN Validation) while others return it as a plain object (e.g. PAN Lite) —
// confirmed inconsistent across their own docs. Normalize both shapes.
const unwrap = (data) => (Array.isArray(data) ? data[0] : data) || {};

// ── RC via Surepass (optional alternative — no chassis/engine required) ───────
// Use if SUREPASS_TOKEN is set. Sign up at https://dashboard.surepass.io
const verifyRCSurepass = async (registrationNo) => {
  try {
    const res = await axios.post(
      'https://kyc-api.surepass.io/api/v1/rc/rc-full-info',
      { id_number: registrationNo },
      {
        headers: {
          Authorization: `Bearer ${process.env.SUREPASS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );
    if (res.data?.status_code !== 200) {
      return { success: false, configured: true, provider: 'surepass', error: res.data?.message || 'RC verification failed' };
    }
    return { success: true, configured: true, provider: 'surepass', data: res.data.data };
  } catch (error) {
    console.error('[Surepass] verifyRC error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      provider: 'surepass',
      error: error.response?.data?.message || error.message,
    };
  }
};

// ── RC via QuickEKYC — /rc/rc_advance ────────────────────────────────────────
// "RC Verification Special v1 API" (Activated) maps to /rc/rc_advance per
// official Postman docs. Chassis + engine (last 5 chars) confirmed required.
const verifyRCQuickekyc = async (registrationNo, chassisNumber, engineNumber) => {
  try {
    const res = await post('/rc/rc_sp_v1', {
      id_number: registrationNo,
      ...(chassisNumber ? { chassis_number: chassisNumber } : {}),
      ...(engineNumber ? { engine_number: engineNumber } : {}),
    });
    if (res.data?.status !== 'success') {
      return { success: false, configured: true, provider: 'quickekyc', error: res.data?.message || 'RC verification failed' };
    }
    return { success: true, configured: true, provider: 'quickekyc', data: res.data.data };
  } catch (error) {
    console.error('[QuickEKYC] verifyRC error:', error.response?.data || error.message);
    const status = error.response?.status;
    const apiMsg = error.response?.data?.message;
    const errorMsg =
      status === 404
        ? 'Vehicle not found in RC database'
        : apiMsg || error.message;
    return {
      success: false,
      configured: true,
      provider: 'quickekyc',
      error: errorMsg,
    };
  }
};

// ── RC verification — Surepass if token set, otherwise QuickEKYC Special v1 ──
const verifyRC = async (registrationNo, chassisNumber, engineNumber) => {
  if (!registrationNo) return { success: false, configured: isRcConfigured(), reason: 'no_registration_no' };

  if (!isRcConfigured()) {
    console.log(`[RC] verifyRC skipped (not configured) for ${registrationNo}`);
    return { success: false, configured: false, reason: 'not_configured' };
  }

  if (isSurepassConfigured()) {
    return verifyRCSurepass(registrationNo);
  }

  return verifyRCQuickekyc(registrationNo, chassisNumber, engineNumber);
};

// ── Pending traffic Challan check ─────────────────────────────────────────────
const checkChallan = async (registrationNo) => {
  if (!registrationNo) return { success: false, configured: isQuickEkycConfigured(), reason: 'no_registration_no' };

  if (!isQuickEkycConfigured()) {
    console.log(`[QuickEKYC] checkChallan skipped (not configured) for ${registrationNo}`);
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    const res = await post('/challan/challan', { id_number: registrationNo });
    if (res.data?.status !== 'success') {
      return { success: false, configured: true, error: res.data?.message || 'Challan check failed' };
    }
    return { success: true, configured: true, data: res.data.data };
  } catch (error) {
    console.error('[QuickEKYC] checkChallan error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

// ── Aadhaar OTP verification (step 1: generate OTP) ───────────────────────────
// Sends an OTP to the mobile number linked to the given Aadhaar number.
// QuickEKYC rate-limits this to once per 45s per Aadhaar number (429 if
// requested sooner) — surfaced via `error` below.
const generateAadhaarOtp = async (aadhaarNumber) => {
  if (!aadhaarNumber) return { success: false, configured: isQuickEkycConfigured(), reason: 'no_aadhaar_number' };

  if (!isQuickEkycConfigured()) {
    console.log('[QuickEKYC] generateAadhaarOtp skipped (not configured)');
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    const res = await post('/aadhaar-v2/generate-otp', { id_number: aadhaarNumber });
    if (res.data?.status !== 'success' || !res.data?.data?.otp_sent) {
      return { success: false, configured: true, error: res.data?.message || 'Failed to send OTP' };
    }
    return { success: true, configured: true, requestId: res.data.request_id };
  } catch (error) {
    console.error('[QuickEKYC] generateAadhaarOtp error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

// ── Aadhaar OTP verification (step 2: submit OTP) ─────────────────────────────
// `requestId` is the `request_id` returned by generateAadhaarOtp.
const submitAadhaarOtp = async (requestId, otp) => {
  if (!requestId || !otp) return { success: false, configured: isQuickEkycConfigured(), reason: 'missing_params' };

  if (!isQuickEkycConfigured()) {
    console.log('[QuickEKYC] submitAadhaarOtp skipped (not configured)');
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    const res = await post('/aadhaar-v2/submit-otp', { request_id: requestId, otp });
    const data = unwrap(res.data?.data);
    if (res.data?.status !== 'success' || !data.aadhaar_number) {
      return { success: false, configured: true, error: res.data?.message || 'Invalid or expired OTP' };
    }
    return { success: true, configured: true, data };
  } catch (error) {
    console.error('[QuickEKYC] submitAadhaarOtp error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

// ── PAN verification — PAN Lite ───────────────────────────────────────────────
const verifyPan = async (panNumber) => {
  if (!panNumber) return { success: false, configured: isQuickEkycConfigured(), reason: 'no_pan_number' };

  if (!isQuickEkycConfigured()) {
    console.log(`[QuickEKYC] verifyPan skipped (not configured) for ${panNumber}`);
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    const res = await post('/pan/pan', { id_number: panNumber });
    if (res.data?.status !== 'success') {
      return { success: false, configured: true, error: res.data?.message || 'PAN verification failed' };
    }
    return { success: true, configured: true, data: unwrap(res.data.data) };
  } catch (error) {
    console.error('[QuickEKYC] verifyPan error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

// ── Driving License verification ──────────────────────────────────────────────
// `dob` (YYYY-MM-DD) is optional only for Kerala/Telangana per QuickEKYC docs.
const verifyDL = async (licenseNumber, dob) => {
  if (!licenseNumber) return { success: false, configured: isQuickEkycConfigured(), reason: 'no_license_number' };

  if (!isQuickEkycConfigured()) {
    console.log(`[QuickEKYC] verifyDL skipped (not configured) for ${licenseNumber}`);
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    const res = await post('/driving-license/driving-license', {
      id_number: licenseNumber,
      ...(dob ? { dob } : {}),
    });
    if (res.data?.status !== 'success') {
      return { success: false, configured: true, error: res.data?.message || 'License verification failed' };
    }
    return { success: true, configured: true, data: unwrap(res.data.data) };
  } catch (error) {
    console.error('[QuickEKYC] verifyDL error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

module.exports = {
  isQuickEkycConfigured,
  isSurepassConfigured,
  isRcConfigured,
  verifyRC,
  checkChallan,
  generateAadhaarOtp,
  submitAadhaarOtp,
  verifyPan,
  verifyDL,
};

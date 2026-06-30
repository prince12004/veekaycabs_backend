const axios = require('axios');

// ─── QuickEKYC (quickekyc.com) client ────────────────────────────────────────
// RC verification + pending traffic Challan check for the admin Vehicle
// Verification page.
//
// NOTE: QuickEKYC's real API docs (exact endpoint paths, auth header name,
// request/response field names) were not available when this was written.
// The HTTP call shape below is a best-guess placeholder based on common
// Indian KYC-aggregator API conventions (POST + API key header + an
// id-number body field) so the plumbing exists end-to-end. It will likely
// need a follow-up edit once real docs are available — see TODOs below.
const QUICKEKYC_BASE_URL = process.env.QUICKEKYC_BASE_URL || 'https://api.quickekyc.com/api/v1';

const isQuickEkycConfigured = () =>
  !!process.env.QUICKEKYC_API_KEY && process.env.QUICKEKYC_API_KEY !== 'placeholder';

// ── RC (Registration Certificate) verification ───────────────────────────────
const verifyRC = async (registrationNo) => {
  if (!registrationNo) return { success: false, configured: isQuickEkycConfigured(), reason: 'no_registration_no' };

  if (!isQuickEkycConfigured()) {
    console.log(`[QuickEKYC] verifyRC skipped (not configured) for ${registrationNo}`);
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    // TODO: confirm exact QuickEKYC endpoint path + request/response shape
    // against their docs before going live.
    const res = await axios.post(
      `${QUICKEKYC_BASE_URL}/rc/rc-full`, // TODO: confirm exact path
      { id_number: registrationNo },      // TODO: confirm exact body field name
      {
        headers: {
          key: process.env.QUICKEKYC_API_KEY, // TODO: confirm exact auth header name/format
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { success: true, configured: true, data: res.data };
  } catch (error) {
    console.error('[QuickEKYC] verifyRC error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

// ── Pending traffic Challan check ─────────────────────────────────────────────
const checkChallan = async (registrationNo) => {
  if (!registrationNo) return { success: false, configured: isQuickEkycConfigured(), reason: 'no_registration_no' };

  if (!isQuickEkycConfigured()) {
    console.log(`[QuickEKYC] checkChallan skipped (not configured) for ${registrationNo}`);
    return { success: false, configured: false, reason: 'not_configured' };
  }

  try {
    // TODO: confirm exact QuickEKYC endpoint path + request/response shape
    // against their docs before going live.
    const res = await axios.post(
      `${QUICKEKYC_BASE_URL}/rc/challan-info`, // TODO: confirm exact path
      { id_number: registrationNo },           // TODO: confirm exact body field name
      {
        headers: {
          key: process.env.QUICKEKYC_API_KEY, // TODO: confirm exact auth header name/format
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    return { success: true, configured: true, data: res.data };
  } catch (error) {
    console.error('[QuickEKYC] checkChallan error:', error.response?.data || error.message);
    return {
      success: false,
      configured: true,
      error: error.response?.data?.message || error.message,
    };
  }
};

module.exports = { isQuickEkycConfigured, verifyRC, checkChallan };

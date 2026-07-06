const axios = require('axios');

// ─── AiSensy (NeoDove WhatsApp) client ───────────────────────────────────────
const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
const AISENSY_USER_NAME = 'VEEKAY CRANES & CABS PRIVATE LIMITED';

const isConfigured = () =>
  process.env.AISENSY_API_KEY &&
  process.env.AISENSY_API_KEY !== 'placeholder';

// Sanitize mobile: strip non-digits, ensure 91 country code
const cleanMobile = (mobile) => {
  if (!mobile) return null;
  const m = mobile.replace(/\D/g, '');
  if (m.length === 10) return `91${m}`;
  return m;
};

// ─── Low-level sender ─────────────────────────────────────────────────────────
// AiSensy template message: templateParams is a plain array of strings (positional)
// mediaDoc: optional { url, filename } for templates that have a Document header
const sendTemplateMessage = async (mobile, campaignName, templateParams = [], mediaDoc = null) => {
  const destination = cleanMobile(mobile);
  if (!destination) return { success: false, reason: 'no_mobile' };

  if (!isConfigured()) {
    console.log(`[WhatsApp template] To ${destination}, campaign=${campaignName}`, templateParams, mediaDoc ? `+ doc: ${mediaDoc.filename}` : '');
    return { success: true };
  }

  try {
    const res = await axios.post(
      AISENSY_API_URL,
      {
        apiKey: process.env.AISENSY_API_KEY,
        campaignName,
        destination,
        userName: AISENSY_USER_NAME,
        templateParams,
        source: 'Veekay Cabs Admin',
        media: mediaDoc ? { url: mediaDoc.url, filename: mediaDoc.filename } : {},
        buttons: [],
        carouselCards: [],
        location: {},
      },
      { timeout: 10000 }
    );
    return { success: true, data: res.data };
  } catch (error) {
    console.error(`[AiSensy] template error [${campaignName}] → to ${destination}:`, JSON.stringify(error.response?.data) || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Session/text message via AiSensy (works within 24h window)
const sendSessionMessage = async (mobile, message) => {
  const destination = cleanMobile(mobile);
  if (!destination) return { success: false, reason: 'no_mobile' };

  if (!isConfigured()) {
    console.log(`[WhatsApp session] To ${destination}: ${message}`);
    return { success: true };
  }

  try {
    const res = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2/messages',
      {
        apiKey: process.env.AISENSY_API_KEY,
        destination,
        userName: AISENSY_USER_NAME,
        source: 'Veekay Cabs Admin',
        message,
      },
      { timeout: 10000 }
    );
    return { success: true, data: res.data };
  } catch (error) {
    console.error('[AiSensy] session message error:', error.response?.data || error.message);
    return { success: false };
  }
};

// ─── Format helpers ───────────────────────────────────────────────────────────
const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

const fmtAmount = (n) => Number(n || 0).toLocaleString('en-IN');

// ─── Template 1 — Booking Confirmed (User) ────────────────────────────────────
// Campaign: vk_booking_confirmed (original 8-field version)
// {{1}} name  {{2}} booking_id  {{3}} car  {{4}} pickup  {{5}} return
// {{6}} location  {{7}} total  {{8}} paid
const sendBookingConfirmedToUser = async (user, booking, car) => {
  return sendTemplateMessage(user.mobile, 'vk_booking_confirmed', [
    user.name || 'Customer',
    booking.bookingId,
    car?.name || 'N/A',
    fmtDate(booking.startTime),
    fmtDate(booking.endTime),
    booking.deliveryAddress || booking.pickupLocation || 'Our Office',
    fmtAmount(booking.totalAmount),
    fmtAmount(booking.amountPaid),
  ]);
};

// ─── Template 1b — Booking Confirmed V2 (User) ────────────────────────────────
// Campaign: vk_booking_confirmed_v2 — approved 11-field version (confirmed
// against the live NeoDove template body on 2026-07-04).
// {{1}} name  {{2}} booking_id  {{3}} car  {{4}} pickup  {{5}} return
// {{6}} location  {{7}} base_fare  {{8}} security_deposit  {{9}} total
// {{10}} paid  {{11}} balance_due
const sendBookingConfirmedV2ToUser = async (user, booking, car) => {
  return sendTemplateMessage(user.mobile, 'vk_booking_confirmed_v2', [
    user.name || 'Customer',
    booking.bookingId,
    car?.name || 'N/A',
    fmtDate(booking.startTime),
    fmtDate(booking.endTime),
    booking.deliveryAddress || booking.pickupLocation || 'Our Office',
    fmtAmount(booking.bookingFare),
    fmtAmount(booking.securityDeposit),
    fmtAmount(booking.totalAmount),
    fmtAmount(booking.amountPaid),
    fmtAmount(booking.balanceDue),
  ]);
};

// ─── Admin mobile list ─────────────────────────────────────────────────────────
// ADMIN_MOBILE supports a comma-separated list to notify multiple numbers
const getAdminMobiles = () =>
  (process.env.ADMIN_MOBILE || '').split(',').map((s) => s.trim()).filter(Boolean);

// ─── Template 2 — New Booking Alert (Admin) ───────────────────────────────────
// Campaign: vk_admin_new_booking
// {{1}} booking_id  {{2}} customer_name  {{3}} mobile  {{4}} car
// {{5}} pickup  {{6}} return  {{7}} delivery  {{8}} amount
const notifyAdminNewBooking = async (booking) => {
  const params = [
    booking.bookingId || booking._id?.toString()?.slice(-8),
    booking.userId?.name || 'Unknown',
    booking.userId?.mobile || 'N/A',
    booking.carId?.name || 'N/A',
    fmtDate(booking.startTime),
    fmtDate(booking.endTime),
    booking.doorstepDelivery ? `Doorstep — ${booking.deliveryAddress || 'N/A'}` : 'Office Pickup',
    fmtAmount(booking.totalAmount),
  ];
  return Promise.all(getAdminMobiles().map((mobile) => sendTemplateMessage(mobile, 'vk_admin_new_booking', params)));
};

// Send a single media document via WhatsApp (session API — no template needed)
const sendDocumentMessage = async (mobile, docUrl, filename, caption = '') => {
  const destination = cleanMobile(mobile);
  if (!destination) return { success: false, error: 'no_mobile' };

  if (!isConfigured()) {
    console.log(`[WhatsApp doc] To ${destination}: ${filename} — ${docUrl}`);
    return { success: true };
  }

  try {
    const res = await axios.post(
      'https://backend.aisensy.com/campaign/t1/api/v2/messages',
      {
        apiKey: process.env.AISENSY_API_KEY,
        destination,
        userName: AISENSY_USER_NAME,
        source: 'Veekay Cabs Admin',
        message: caption,
        media: { url: docUrl, filename },
      },
      { timeout: 15000 }
    );
    return { success: true, data: res.data };
  } catch (error) {
    console.error(`[AiSensy] doc send error [${filename}]:`, error.response?.data || error.message);
    return { success: false, error: error.response?.data?.message || error.message };
  }
};

// Strip query params only. Uploads created before the public_id fix in
// middleware/upload.js have no ".pdf" suffix on the raw URL — appending one
// now returns 404 since it doesn't match the stored public_id. New uploads
// already end in ".pdf" and serve with the correct Content-Type.
const toMediaUrl = (url) => url.split('?')[0];

// ─── Template 3 — Car Docs to Customer ───────────────────────────────────────
const sendCarDocsToCustomer = async (mobile, customerName, car, bookingId, availableDocs = []) => {
  const destination = cleanMobile(mobile);
  const errors = [];

  // 1. Text notification (car_documents_ready — 4 params, always works)
  await sendTemplateMessage(mobile, 'car_documents_ready', [
    customerName,
    bookingId,
    car?.name || 'N/A',
    car?.registrationNo || 'N/A',
  ]);

  if (availableDocs.length === 0) return { success: true, errors: [] };
  if (!isConfigured()) {
    availableDocs.forEach(d => console.log(`[WhatsApp doc] ${d.label}: ${d.url}`));
    return { success: true, errors: [] };
  }

  // 2. Send each doc via car_doc_link FILE template (5 params, media = actual file URL)
  // NOTE: car_doc_link must be approved on AiSensy as a Document-header template —
  // AiSensy silently ignores the media field on TEXT-header templates.
  // {{1}}=name {{2}}=bookingId {{3}}=car {{4}}=regNo {{5}}=downloadUrl (text backup link)
  // media.url = Cloudinary raw URL (no .pdf suffix — confirmed working, file is real PDF)
  for (const doc of availableDocs) {
    await new Promise(r => setTimeout(r, 2000));
    const mediaUrl = toMediaUrl(doc.url);
    const filename = `${doc.label.replace(/\s+/g, '_')}_${bookingId}.pdf`;
    const result = await sendTemplateMessage(
      mobile,
      'car_doc_link',
      [customerName, bookingId, car?.name || 'N/A', car?.registrationNo || 'N/A', mediaUrl],
      { url: mediaUrl, filename }
    );
    console.log(`[sendCarDocs] car_doc_link [${doc.label}]:`, JSON.stringify(result?.data));
    if (!result.success) {
      errors.push({ label: doc.label, error: result.error || 'Failed' });
    }
  }

  return { success: true, errors };
};

// ─── Template — Booking Invoice (User) ────────────────────────────────────────
// Campaign: vk_booking_invoice — Document-header template (requires AiSensy approval)
// {{1}} name  {{2}} bookingId  {{3}} car  {{4}} total_amount  {{5}} paid_amount
const sendBookingInvoiceToUser = async (mobile, customerName, booking, car, mediaUrl) => {
  const filename = `Invoice_${booking.bookingId}.pdf`;
  const result = await sendTemplateMessage(
    mobile,
    'vk_booking_invoice',
    [customerName, booking.bookingId, car?.name || 'N/A', fmtAmount(booking.totalAmount), fmtAmount(booking.amountPaid)],
    { url: toMediaUrl(mediaUrl), filename }
  );
  console.log('[sendBookingInvoiceToUser] vk_booking_invoice response:', JSON.stringify(result?.data), 'media url:', toMediaUrl(mediaUrl));
  return result;
};

// ─── Template 4 — Booking Cancelled (User) ────────────────────────────────────
// Campaign: vk_booking_cancelled
// {{1}} customer_name  {{2}} booking_id  {{3}} car_name
const sendBookingCancelledToUser = async (user, booking, car) => {
  return sendTemplateMessage(user.mobile, 'vk_booking_cancelled', [
    user.name || 'Customer',
    booking.bookingId,
    car?.name || 'N/A',
  ]);
};

// ─── Template 5 — Pickup Reminder ────────────────────────────────────────────
// Campaign: vk_pickup_reminder
// {{1}} customer_name  {{2}} booking_id  {{3}} car  {{4}} pickup_time  {{5}} location
const sendPickupReminder = async (user, booking, car) => {
  return sendTemplateMessage(user.mobile, 'vk_pickup_reminder', [
    user.name || 'Customer',
    booking.bookingId,
    car?.name || 'N/A',
    fmtDate(booking.startTime),
    booking.deliveryAddress || booking.pickupLocation || 'Our Office',
  ]);
};

// ─── Legacy helpers ───────────────────────────────────────────────────────────
const sendWhatsAppMessage = sendSessionMessage;

const notifyAdminNewContact = async (contact) => {
  const msg = `New ${contact.type || 'General'} Inquiry!\nName: ${contact.name}\nMobile: ${contact.mobile}\nMessage: ${contact.message || 'N/A'}`;
  return Promise.all(getAdminMobiles().map((mobile) => sendSessionMessage(mobile, msg)));
};

module.exports = {
  sendWhatsAppMessage,
  sendSessionMessage,
  sendTemplateMessage,
  notifyAdminNewBooking,
  notifyAdminNewContact,
  sendBookingConfirmedToUser,
  sendBookingConfirmedV2ToUser,
  sendCarDocsToCustomer,
  sendBookingCancelledToUser,
  sendPickupReminder,
  sendBookingInvoiceToUser,
};

const express = require('express');
const router = express.Router();
const {
  getAllBookings,
  getSchedule,
  getClosingBills,
  getBookingDetail,
  createOfflineBooking,
  exportBookings,
  updateBookingStatus,
  updateBooking,
  extendBooking,
  deleteBooking,
  updateVehicleVerification,
  sendInvoiceWhatsApp,
  closeBooking,
  markRefundPaid,
  sendClosingBillWhatsApp,
} = require('../../controllers/admin/adminBookingsController');
const {
  uploadBookingMedia,
  getBookingMedia,
  deleteBookingMedia,
  analyzeVehicleDamage,
  runDentDetection,
  getBookingUserDocs,
  sendCarDocsWhatsApp,
} = require('../../controllers/admin/adminBookingMediaController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');

router.use(protectAdmin);

// Core booking routes
router.get('/export', exportBookings);
router.get('/schedule', getSchedule);
router.get('/closing-bills', getClosingBills);
router.get('/', getAllBookings);
router.post('/offline', createOfflineBooking);
router.get('/:id', getBookingDetail);
router.patch('/:id/status', updateBookingStatus);
router.patch('/:id/verification', updateVehicleVerification);
router.patch('/:id/close', closeBooking);
router.patch('/:id/extend', extendBooking);
router.patch('/:id/refund-paid', markRefundPaid);
router.put('/:id', updateBooking);
router.delete('/:id', requirePermission('bookings', 'delete'), deleteBooking);

// Media (video/photo) upload — up to 10 files per call
router.post('/:id/media', getUploader('booking-media').array('files', 10), uploadBookingMedia);
router.get('/:id/media', getBookingMedia);
router.delete('/:id/media/:mediaId', deleteBookingMedia);

// AI dent analysis (compares pickup vs return media)
router.post('/:id/analyze-damage', analyzeVehicleDamage);

// Claude-powered dent detection (compares pickup vs return media, cached on booking)
router.post('/:id/dent-detection', runDentDetection);

// User KYC documents for a booking
router.get('/:id/user-docs', getBookingUserDocs);

// Send car documents to customer via WhatsApp
router.post('/:id/send-car-docs', sendCarDocsWhatsApp);

// Upload invoice PDF + send to customer via WhatsApp
router.post('/:id/invoice/send-whatsapp', getUploader('booking-invoices').single('file'), sendInvoiceWhatsApp);

// Upload closing/final-settlement bill PDF + send to customer via WhatsApp
router.post('/:id/closing-bill/send-whatsapp', getUploader('booking-invoices').single('file'), sendClosingBillWhatsApp);

module.exports = router;

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
const { protectAdmin, requirePermission, requireAnyPermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');

router.use(protectAdmin);

// "All Bookings" and "Offline Booking" are two sidebar pages backed by the
// SAME booking resource — an edit/delete here can't be attributed to one
// page over the other, so either permission unlocks these shared actions.
const editEither = requireAnyPermission([['allBookings', 'edit'], ['offlineBooking', 'edit']]);
const deleteEither = requireAnyPermission([['allBookings', 'delete'], ['offlineBooking', 'delete']]);

// Core booking routes
router.get('/export', exportBookings);
router.get('/schedule', getSchedule);
router.get('/closing-bills', getClosingBills);
router.get('/', getAllBookings);
router.post('/offline', requirePermission('offlineBooking', 'add'), createOfflineBooking);
router.get('/:id', getBookingDetail);
router.patch('/:id/status', editEither, updateBookingStatus);
router.patch('/:id/verification', editEither, updateVehicleVerification);
router.patch('/:id/close', editEither, closeBooking);
router.patch('/:id/extend', editEither, extendBooking);
router.patch('/:id/refund-paid', editEither, markRefundPaid);
router.put('/:id', editEither, updateBooking);
router.delete('/:id', deleteEither, deleteBooking);

// Media (video/photo) upload — up to 10 files per call
router.post('/:id/media', editEither, getUploader('booking-media').array('files', 10), uploadBookingMedia);
router.get('/:id/media', getBookingMedia);
router.delete('/:id/media/:mediaId', editEither, deleteBookingMedia);

// AI dent analysis (compares pickup vs return media)
router.post('/:id/analyze-damage', editEither, analyzeVehicleDamage);

// Claude-powered dent detection (compares pickup vs return media, cached on booking)
router.post('/:id/dent-detection', editEither, runDentDetection);

// User KYC documents for a booking
router.get('/:id/user-docs', getBookingUserDocs);

// Send car documents to customer via WhatsApp
router.post('/:id/send-car-docs', editEither, sendCarDocsWhatsApp);

// Upload invoice PDF + send to customer via WhatsApp
router.post('/:id/invoice/send-whatsapp', editEither, getUploader('booking-invoices').single('file'), sendInvoiceWhatsApp);

// Upload closing/final-settlement bill PDF + send to customer via WhatsApp
router.post('/:id/closing-bill/send-whatsapp', editEither, getUploader('booking-invoices').single('file'), sendClosingBillWhatsApp);

module.exports = router;

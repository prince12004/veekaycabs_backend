const axios = require('axios');

const watiApi = axios.create({
  baseURL: process.env.WATI_API_URL,
  headers: { Authorization: `Bearer ${process.env.WATI_ACCESS_TOKEN}` },
});

const sendWhatsAppMessage = async (mobile, message) => {
  try {
    if (!process.env.WATI_ACCESS_TOKEN || process.env.WATI_ACCESS_TOKEN === 'placeholder') {
      console.log(`[WhatsApp] To ${mobile}: ${message}`);
      return { success: true };
    }
    const res = await watiApi.post(`/api/v1/sendSessionMessage/${mobile}`, {
      messageText: message,
    });
    return { success: true, data: res.data };
  } catch (error) {
    console.error('WhatsApp error:', error.message);
    return { success: false };
  }
};

const notifyAdminNewBooking = async (booking) => {
  const msg =
    `New Booking!\nID: ${booking.bookingId}\nCar: ${booking.carId?.name || 'N/A'}\nAmount: Rs. ${booking.totalAmount}\nStatus: ${booking.status}`;
  return sendWhatsAppMessage(process.env.WATI_ADMIN_MOBILE, msg);
};

const notifyAdminNewContact = async (contact) => {
  const msg =
    `New ${contact.type} Inquiry!\nName: ${contact.name}\nMobile: ${contact.mobile}\nMessage: ${contact.message || 'N/A'}`;
  return sendWhatsAppMessage(process.env.WATI_ADMIN_MOBILE, msg);
};

module.exports = { sendWhatsAppMessage, notifyAdminNewBooking, notifyAdminNewContact };

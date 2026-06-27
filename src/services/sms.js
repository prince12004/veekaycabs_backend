const axios = require('axios');

const sendOtpSms = async (mobile, otp) => {
  try {
    if (!process.env.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY === 'placeholder') {
      console.log(`[DEV] OTP for ${mobile}: ${otp}`);
      return { success: true };
    }
    const response = await axios.post('https://api.msg91.com/api/v5/otp', {
      template_id: process.env.MSG91_TEMPLATE_ID,
      mobile: `91${mobile}`,
      authkey: process.env.MSG91_AUTH_KEY,
      otp,
    });
    return { success: true, data: response.data };
  } catch (error) {
    console.error('SMS error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendBookingConfirmationSms = async (mobile, bookingId, carName) => {
  console.log(`[SMS] Booking ${bookingId} for ${carName} confirmed to ${mobile}`);
};

module.exports = { sendOtpSms, sendBookingConfirmationSms };

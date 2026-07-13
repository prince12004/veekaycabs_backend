const axios = require('axios');

const sendOtpSms = async (mobile, otp) => {
  try {
    const authKey = String(process.env.YOURBULKSMS_AUTH_KEY || '').trim();
    if (!authKey || authKey === 'placeholder') {
      console.log(`[DEV] OTP for ${mobile}: ${otp}`);
      return { success: true };
    }

    console.log('[SMS] authKey loaded, length:', authKey.length, '| first4:', authKey.slice(0, 4));

    const sender = String(process.env.YOURBULKSMS_SENDER_ID || 'VKCABS').trim();
    const dltId  = String(process.env.YOURBULKSMS_DLT_TE_ID  || '').trim();
    const message = `Welcome to Veekay Cabs Your OTP for verification is ${otp} Keep it confidential. Happy riding!`;

    const url = `http://control.yourbulksms.com/api/sendhttp.php`
      + `?authkey=${authKey}`
      + `&mobiles=91${mobile}`
      + `&message=${encodeURIComponent(message)}`
      + `&sender=${sender}`
      + `&route=2`
      + `&country=0`
      + (dltId ? `&DLT_TE_ID=${dltId}` : '');

    console.log('[SMS] Full URL:', url);

    const response = await axios.get(url, { timeout: 10000 });
    const resData = typeof response.data === 'object'
      ? JSON.stringify(response.data)
      : String(response.data).trim();

    console.log('[SMS] API response:', resData);

    // YourBulkSMS returns either a plain numeric message ID (legacy routes)
    // or a JSON object like {"Status":"Success","Code":"000",...} (route=2).
    const isSuccess = typeof response.data === 'object'
      ? response.data.Status === 'Success' || response.data.Code === '000'
      : /^\d+$/.test(resData);

    return isSuccess
      ? { success: true, data: resData }
      : { success: false, error: resData };

  } catch (error) {
    console.error('[SMS] Error:', error.message);
    return { success: false, error: error.message };
  }
};

const sendBookingConfirmationSms = async (mobile, bookingId, carName) => {
  console.log(`[SMS] Booking ${bookingId} for ${carName} confirmed to ${mobile}`);
};

module.exports = { sendOtpSms, sendBookingConfirmationSms };

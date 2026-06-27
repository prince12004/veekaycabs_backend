const sgMail = require('@sendgrid/mail');

const initSendGrid = () => {
  if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'placeholder') {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  }
};

initSendGrid();

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'placeholder') {
      console.log(`[Email] To: ${to}, Subject: ${subject}`);
      return { success: true };
    }
    await sgMail.send({
      to,
      from: { email: process.env.FROM_EMAIL, name: 'Veekay Cabs' },
      subject,
      html,
      text: text || subject,
    });
    return { success: true };
  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false };
  }
};

const sendBookingConfirmation = async (user, booking, car) => {
  if (!user.email) return { success: false, message: 'No email on user record' };
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:40px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:30px;">
        <h1 style="color:#E8540A;font-size:28px;margin:0;">Veekay Cabs</h1>
        <p style="color:#666;margin:5px 0;">Booking Confirmation</p>
      </div>
      <div style="background:#FFF3ED;border-radius:12px;padding:20px;margin-bottom:20px;">
        <h2 style="color:#0F0F1A;margin:0 0 10px;">Booking Confirmed!</h2>
        <p style="color:#4A4A6A;margin:0;">Booking ID: <strong>${booking.bookingId}</strong></p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E4E5EF;color:#666;">Car</td>
          <td style="padding:10px 0;border-bottom:1px solid #E4E5EF;font-weight:600;">${car.name}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E4E5EF;color:#666;">Pickup</td>
          <td style="padding:10px 0;border-bottom:1px solid #E4E5EF;font-weight:600;">${new Date(booking.startTime).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #E4E5EF;color:#666;">Return</td>
          <td style="padding:10px 0;border-bottom:1px solid #E4E5EF;font-weight:600;">${new Date(booking.endTime).toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#666;">Total Amount</td>
          <td style="padding:10px 0;font-weight:600;color:#E8540A;">Rs. ${booking.totalAmount}</td>
        </tr>
      </table>
      <p style="text-align:center;color:#666;font-size:14px;margin-top:30px;">Need help? Call us at +91 99999 26867</p>
    </div>
  `;
  return sendEmail({
    to: user.email,
    subject: `Booking Confirmed - ${booking.bookingId} | Veekay Cabs`,
    html,
  });
};

const sendCancellationEmail = async (user, booking) => {
  if (!user.email) return { success: false };
  const html = `
    <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;background:#fff;padding:40px;border-radius:16px;">
      <h1 style="color:#E8540A;">Veekay Cabs</h1>
      <h2>Booking Cancelled</h2>
      <p>Your booking <strong>${booking.bookingId}</strong> has been cancelled.</p>
      ${booking.refundAmount > 0 ? `<p>Refund of <strong>Rs. ${booking.refundAmount}</strong> will be processed within 5-7 business days.</p>` : ''}
      <p>For queries contact us at +91 99999 26867 or sales@veekaycabs.com</p>
    </div>
  `;
  return sendEmail({
    to: user.email,
    subject: `Booking Cancelled - ${booking.bookingId} | Veekay Cabs`,
    html,
  });
};

module.exports = { sendEmail, sendBookingConfirmation, sendCancellationEmail };

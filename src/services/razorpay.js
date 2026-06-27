const Razorpay = require('razorpay');
const crypto = require('crypto');

let razorpayInstance;

const getRazorpay = () => {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpayInstance;
};

const createOrder = async (amount, currency = 'INR', receipt, notes = {}) => {
  const rzp = getRazorpay();
  return rzp.orders.create({ amount: Math.round(amount * 100), currency, receipt, notes });
};

const createRefund = async (paymentId, amount) => {
  const rzp = getRazorpay();
  return rzp.payments.refund(paymentId, { amount: Math.round(amount * 100) });
};

const verifyWebhookSignature = (rawBody, signature) => {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return expectedSignature === signature;
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const generated = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return generated === signature;
};

module.exports = { createOrder, createRefund, verifyWebhookSignature, verifyPaymentSignature, getRazorpay };

const Booking = require('../models/Booking');
const TempoBooking = require('../models/TempoBooking');
const Coupon = require('../models/Coupon');
const Refund = require('../models/Refund');
const User = require('../models/User');
const { createOrder, verifyPaymentSignature, verifyWebhookSignature, createRefund } = require('../services/razorpay');
const { sendBookingConfirmation } = require('../services/email');
const { sendBookingConfirmationSms } = require('../services/sms');
const { notifyAdminNewBooking, sendBookingConfirmedV2ToUser } = require('../services/whatsapp');

// POST /api/payments/create-order
const createPaymentOrder = async (req, res) => {
  try {
    const { bookingId, amount, purpose } = req.body;
    if (!amount || !purpose) {
      return res.status(400).json({ success: false, message: 'amount and purpose are required' });
    }

    let notes = { purpose, userId: req.user._id.toString() };
    if (bookingId) notes.bookingId = bookingId;

    const order = await createOrder(amount, 'INR', `ord_${Date.now()}`, notes);

    return res.json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error('createPaymentOrder error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
};

// POST /api/payments/verify
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, type } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment details are required' });
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // ── Tempo Booking payment ─────────────────────────────────────────────────
    if (type === 'tempo') {
      const tempoBooking = await TempoBooking.findById(bookingId).populate('userId').populate('tempoId');
      if (!tempoBooking) {
        return res.status(404).json({ success: false, message: 'Tempo booking not found' });
      }
      tempoBooking.razorpayPaymentId = razorpay_payment_id;
      tempoBooking.amountPaid = tempoBooking.tokenAmount;
      tempoBooking.status = 'confirmed';
      await tempoBooking.save();
      await User.findByIdAndUpdate(tempoBooking.userId, { $inc: { totalBookings: 1 } });

      try {
        await notifyAdminNewBooking({
          bookingId: tempoBooking.bookingId,
          userId: tempoBooking.userId,
          carId: { name: tempoBooking.tempoId?.name || 'Tempo Traveller' },
          startTime: tempoBooking.startTime,
          endTime: tempoBooking.endTime,
          doorstepDelivery: true,
          deliveryAddress: `${tempoBooking.pickupCity} → ${tempoBooking.destination}`,
          totalAmount: tempoBooking.totalAmount,
        });
      } catch (notifyErr) {
        console.error('Tempo booking admin notification error (non-fatal):', notifyErr.message);
      }

      return res.json({
        success: true,
        message: 'Tempo booking confirmed!',
        data: { bookingId: tempoBooking.bookingId, status: tempoBooking.status },
      });
    }

    // ── Car Rental Booking payment ─────────────────────────────────────────────
    let booking;
    if (bookingId) {
      booking = await Booking.findOne({ bookingId }).populate('carId').populate('userId');
    } else {
      booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id }).populate('carId').populate('userId');
    }

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.razorpayPaymentId = razorpay_payment_id;
    booking.amountPaid = booking.tokenAmount;
    booking.balanceDue = booking.totalAmount - booking.amountPaid;
    booking.status = 'confirmed';
    await booking.save();

    // Increment coupon usage
    if (booking.couponCode) {
      await Coupon.findOneAndUpdate({ code: booking.couponCode }, { $inc: { usedCount: 1 } });
    }

    // Increment user total bookings
    await User.findByIdAndUpdate(booking.userId, { $inc: { totalBookings: 1 } });

    // Send notifications
    const user = await User.findById(booking.userId);
    const car = booking.carId;

    try {
      if (user?.email) await sendBookingConfirmation(user, booking, car);
      if (user?.mobile) await sendBookingConfirmationSms(user.mobile, booking.bookingId, car.name);
      if (user?.mobile) await sendBookingConfirmedV2ToUser(user, booking, car);
      await notifyAdminNewBooking(booking);
    } catch (notifyErr) {
      console.error('Notification error (non-fatal):', notifyErr.message);
    }

    return res.json({
      success: true,
      message: 'Payment verified and booking confirmed',
      data: { bookingId: booking.bookingId, status: booking.status },
    });
  } catch (error) {
    console.error('verifyPayment error:', error);
    return res.status(500).json({ success: false, message: 'Payment verification error' });
  }
};

// POST /api/webhooks/razorpay  (raw body)
const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = JSON.parse(rawBody.toString());
    const eventType = event.event;

    if (eventType === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      const booking = await Booking.findOne({ razorpayOrderId: orderId }).populate('carId').populate('userId');
      if (booking && booking.status === 'pending') {
        booking.razorpayPaymentId = payment.id;
        booking.amountPaid = payment.amount / 100;
        booking.balanceDue = booking.totalAmount - booking.amountPaid;
        booking.status = 'confirmed';
        await booking.save();

        if (booking.couponCode) {
          await Coupon.findOneAndUpdate({ code: booking.couponCode }, { $inc: { usedCount: 1 } });
        }
        await User.findByIdAndUpdate(booking.userId, { $inc: { totalBookings: 1 } });

        try {
          await notifyAdminNewBooking(booking);
        } catch (notifyErr) {
          console.error('Webhook admin notification error (non-fatal):', notifyErr.message);
        }
      }
    }

    if (eventType === 'refund.processed') {
      const refundEntity = event.payload.refund.entity;
      await Refund.findOneAndUpdate(
        { razorpayRefundId: refundEntity.id },
        { status: 'processed', processedAt: new Date() }
      );
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ success: false });
  }
};

module.exports = { createPaymentOrder, verifyPayment, razorpayWebhook };

const ContactRequest = require('../models/ContactRequest');
const { notifyAdminNewContact } = require('../services/whatsapp');
const { sendEmail } = require('../services/email');

// POST /api/contact
const createContactRequest = async (req, res) => {
  try {
    const {
      type = 'general',
      name,
      mobile,
      email,
      subject,
      message,
      journeyDate,
      passengers,
      tripType,
      pickupLocation,
      destination,
      specialRequirements,
    } = req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'name and mobile are required' });
    }
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required' });
    }

    const contact = await ContactRequest.create({
      type,
      name,
      mobile,
      email,
      subject,
      message,
      journeyDate,
      passengers,
      tripType,
      pickupLocation,
      destination,
      specialRequirements,
    });

    // Notify admin via WhatsApp
    try {
      await notifyAdminNewContact(contact);
    } catch (err) {
      console.error('WhatsApp notify error:', err.message);
    }

    // Send confirmation to user
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: 'We received your enquiry | Veekay Cabs',
          html: `
            <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px;">
              <h1 style="color:#E8540A;">Veekay Cabs</h1>
              <h2>Thank you, ${name}!</h2>
              <p>We have received your enquiry and our team will get in touch with you within 24 hours.</p>
              <p>For urgent queries, call us at <strong>+91 99999 26867</strong></p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Contact confirmation email error:', emailErr.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Your enquiry has been submitted. We will contact you shortly.',
      data: { _id: contact._id },
    });
  } catch (error) {
    console.error('createContactRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit enquiry' });
  }
};

module.exports = { createContactRequest };

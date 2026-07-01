const ContactRequest = require('../../models/ContactRequest');

// GET /api/admin/contact-requests
const getAllContacts = async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const [total, contacts] = await Promise.all([
      ContactRequest.countDocuments(filter),
      ContactRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
    ]);

    return res.json({
      success: true,
      data: contacts,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('admin getAllContacts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch contact requests' });
  }
};

// PATCH /api/admin/contact-requests/:id
const updateContactStatus = async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const updates = {};
    if (status && ['new', 'contacted', 'resolved'].includes(status)) updates.status = status;
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;

    const contact = await ContactRequest.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!contact) return res.status(404).json({ success: false, message: 'Contact request not found' });

    return res.json({ success: true, data: contact });
  } catch (error) {
    console.error('admin updateContactStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update contact request' });
  }
};

module.exports = { getAllContacts, updateContactStatus };

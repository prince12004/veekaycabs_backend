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

// GET /api/admin/contact-requests/export
const exportContacts = async (req, res) => {
  try {
    const contacts = await ContactRequest.find({}).sort({ createdAt: -1 }).limit(10000);

    const headers = ['Type', 'Name', 'Mobile', 'Email', 'Subject', 'Message', 'Status', 'Created At'];

    const rows = contacts.map((c) => [
      c.type || '',
      c.name || '',
      c.mobile || '',
      c.email || '',
      c.subject || '',
      c.message || '',
      c.status,
      new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="contact-requests-${Date.now()}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error('admin exportContacts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to export contact requests' });
  }
};

module.exports = { getAllContacts, updateContactStatus, exportContacts };

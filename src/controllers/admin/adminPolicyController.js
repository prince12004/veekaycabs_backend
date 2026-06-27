const PolicyPage = require('../../models/PolicyPage');

const DEFAULTS = {
  about:        { title: 'About Us', content: '<h2>About Veekay Cabs</h2><p>We are Delhi NCR\'s most trusted self-drive car rental service.</p>' },
  privacy:      { title: 'Privacy Policy', content: '<h2>Privacy Policy</h2><p>We value your privacy...</p>' },
  terms:        { title: 'Terms & Conditions', content: '<h2>Terms & Conditions</h2><p>By using Veekay Cabs...</p>' },
  refund:       { title: 'Refund Policy', content: '<h2>Refund Policy</h2><p>Refunds are processed within 5-7 business days...</p>' },
  cancellation: { title: 'Cancellation Policy', content: '<h2>Cancellation Policy</h2><p>Free cancellation up to 24 hours before pickup...</p>' },
};

const getPage = async (req, res) => {
  try {
    const { key } = req.params;
    let page = await PolicyPage.findOne({ pageKey: key });
    if (!page) {
      // Return default if not yet created
      const def = DEFAULTS[key];
      if (!def) return res.status(404).json({ success: false, message: 'Page not found' });
      return res.json({ success: true, data: { pageKey: key, ...def, exists: false } });
    }
    return res.json({ success: true, data: { ...page.toObject(), exists: true } });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch page' });
  }
};

const getAllPages = async (req, res) => {
  try {
    const pages = await PolicyPage.find().select('-content');
    return res.json({ success: true, data: pages });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pages' });
  }
};

const upsertPage = async (req, res) => {
  try {
    const { key } = req.params;
    const { title, content, metaTitle, metaDesc } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content required' });
    const page = await PolicyPage.findOneAndUpdate(
      { pageKey: key },
      { title: title || DEFAULTS[key]?.title || key, content, metaTitle, metaDesc, lastEditedBy: req.admin._id },
      { new: true, upsert: true }
    );
    return res.json({ success: true, data: page, message: 'Page saved successfully' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to save page' });
  }
};

module.exports = { getPage, getAllPages, upsertPage };

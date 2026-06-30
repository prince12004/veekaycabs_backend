const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protectAdmin } = require('../../middleware/adminAuth');
const { sendTemplateMessage, sendSessionMessage } = require('../../services/whatsapp');

router.use(protectAdmin);

// POST /api/admin/whatsapp/test
router.post('/test', async (req, res) => {
  try {
    const { mobile, campaignName, templateParams, message } = req.body;
    if (!mobile) return res.status(400).json({ success: false, message: 'Mobile required' });

    let result;
    if (message) {
      result = await sendSessionMessage(mobile, message);
    } else if (campaignName) {
      result = await sendTemplateMessage(mobile, campaignName, templateParams || []);
    } else {
      return res.status(400).json({ success: false, message: 'Provide campaignName or message' });
    }

    if (result.success) {
      return res.json({ success: true, message: 'Message sent!', data: result.data });
    } else {
      return res.status(400).json({ success: false, message: result.error || 'Failed to send' });
    }
  } catch (error) {
    console.error('whatsapp test error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/admin/whatsapp/test-doc — raw AiSensy doc template call, returns full response
router.post('/test-doc', async (req, res) => {
  try {
    const { mobile, mediaUrl, filename } = req.body;
    if (!mobile || !mediaUrl) return res.status(400).json({ success: false, message: 'mobile and mediaUrl required' });

    const destination = mobile.replace(/\D/g, '').length === 10 ? `91${mobile.replace(/\D/g, '')}` : mobile.replace(/\D/g, '');
    const payload = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: 'car_docs_with_file',
      destination,
      userName: 'VEEKAY CRANES & CABS PRIVATE LIMITED',
      templateParams: ['Test Customer', 'TEST001', 'Test Car', 'DL01AB0001', 'RC Book'],
      source: 'Veekay Cabs Admin',
      media: { url: mediaUrl, filename: filename || 'RC_Book_TEST001.pdf' },
      buttons: [],
      carouselCards: [],
      location: {},
    };

    console.log('[test-doc] payload:', JSON.stringify(payload));
    const response = await axios.post('https://backend.aisensy.com/campaign/t1/api/v2', payload, { timeout: 15000 });
    console.log('[test-doc] response:', JSON.stringify(response.data));
    return res.json({ success: true, aisensy: response.data, payload });
  } catch (err) {
    console.error('[test-doc] error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.response?.data || err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { getAllContacts, updateContactStatus, exportContacts } = require('../../controllers/admin/adminContactsController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/export', exportContacts);
router.get('/', getAllContacts);
router.patch('/:id', requirePermission('contactRequests', 'edit'), updateContactStatus);

module.exports = router;

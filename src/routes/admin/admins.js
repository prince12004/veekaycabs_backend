const express = require('express');
const router = express.Router();
const { getAllAdmins, createAdmin, updateAdmin, deleteAdmin } = require('../../controllers/admin/adminAdminsController');
const { protectAdmin, superAdminOnly } = require('../../middleware/adminAuth');

// Managing admin accounts (including who can delete/create/promote other
// admins) is deliberately not delegable — only super_admin can touch this
// router at all, unlike the per-section delete permissions elsewhere.
router.use(protectAdmin, superAdminOnly);

router.get('/', getAllAdmins);
router.post('/', createAdmin);
router.put('/:id', updateAdmin);
router.delete('/:id', deleteAdmin);

module.exports = router;

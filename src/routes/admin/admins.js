const express = require('express');
const router = express.Router();
const { getAllAdmins, createAdmin, updateAdmin, deleteAdmin } = require('../../controllers/admin/adminAdminsController');
const { protectAdmin, superAdminOnly } = require('../../middleware/adminAuth');

router.use(protectAdmin, superAdminOnly);

router.get('/', getAllAdmins);
router.post('/', createAdmin);
router.put('/:id', updateAdmin);
router.delete('/:id', deleteAdmin);

module.exports = router;

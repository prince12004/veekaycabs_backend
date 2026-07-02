const express = require('express');
const router = express.Router();
const { getAllUsers, getUserDetail, toggleBlockUser, updateUser, exportUsers } = require('../../controllers/admin/adminUsersController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/export', exportUsers);
router.get('/', getAllUsers);
router.get('/:id', getUserDetail);
router.patch('/:id/block', toggleBlockUser);
router.put('/:id', updateUser);

module.exports = router;

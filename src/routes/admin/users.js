const express = require('express');
const router = express.Router();
const { getAllUsers, getUserDetail, toggleBlockUser, updateUser, deleteUser, exportUsers } = require('../../controllers/admin/adminUsersController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/export', exportUsers);
router.get('/', getAllUsers);
router.get('/:id', getUserDetail);
router.patch('/:id/block', requirePermission('userList', 'edit'), toggleBlockUser);
router.put('/:id', requirePermission('userList', 'edit'), updateUser);
router.delete('/:id', requirePermission('userList', 'delete'), deleteUser);

module.exports = router;

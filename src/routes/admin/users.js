const express = require('express');
const router = express.Router();
const { getAllUsers, getUserDetail, toggleBlockUser } = require('../../controllers/admin/adminUsersController');
const { protectAdmin } = require('../../middleware/adminAuth');

router.use(protectAdmin);

router.get('/', getAllUsers);
router.get('/:id', getUserDetail);
router.patch('/:id/block', toggleBlockUser);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
  getAllBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  togglePublish,
} = require('../../controllers/admin/adminBlogsController');
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getUploader } = require('../../middleware/upload');

router.use(protectAdmin);

router.get('/', getAllBlogs);
router.post('/', getUploader('blogs').single('coverImage'), createBlog);
router.get('/:id', getBlogById);
router.put('/:id', getUploader('blogs').single('coverImage'), updateBlog);
router.delete('/:id', requirePermission('content', 'delete'), deleteBlog);
router.patch('/:id/publish', togglePublish);

module.exports = router;

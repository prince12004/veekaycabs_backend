const router = require('express').Router();
const { protectAdmin, requireAnyPermission } = require('../../middleware/adminAuth');
const { getUploader, getFileUrl } = require('../../middleware/upload');

// SVG is excluded: it can carry script and would be served from our own storage.
const EDITOR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// POST /api/admin/editor-uploads/image — images dropped or pasted into the rich
// text editor, so article HTML stores a URL rather than a huge base64 string.
router.post(
  '/image',
  protectAdmin,
  requireAnyPermission([
    ['blogs', 'add'], ['blogs', 'edit'],
    ['seoPages', 'add'], ['seoPages', 'edit'],
    ['tempoAdmin', 'add'], ['tempoAdmin', 'edit'],
    ['policyPages', 'edit'],
  ]),
  getUploader('content').single('upload'),
  (req, res) => {
    if (!req.file || !EDITOR_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, message: 'Please upload a JPG, PNG, WebP or GIF image' });
    }
    return res.status(201).json({ success: true, url: getFileUrl(req.file) });
  }
);

module.exports = router;

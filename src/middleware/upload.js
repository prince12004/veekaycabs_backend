const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
const ALLOWED_VIDEO_FORMATS = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
const ALLOWED_FORMATS = [...ALLOWED_IMAGE_FORMATS, ...ALLOWED_VIDEO_FORMATS];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (ALLOWED_FORMATS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg, png, webp), PDFs, and videos (mp4, mov) are allowed'), false);
  }
};

const isCloudinaryConfigured = () =>
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'placeholder' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'placeholder';

const uploadToCloudinary = (folder) =>
  multer({
    storage: new CloudinaryStorage({
      cloudinary,
      params: (req, file) => {
        const isVideo = file.mimetype.startsWith('video/');
        const isPdf   = file.mimetype === 'application/pdf';
        return {
          folder: `veekaycabs/${folder}`,
          public_id: uuidv4(),
          resource_type: isVideo ? 'video' : isPdf ? 'raw' : 'image',
          allowed_formats: isVideo ? ALLOWED_VIDEO_FORMATS : ALLOWED_IMAGE_FORMATS,
        };
      },
    }),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

const uploadToDisk = (folder) =>
  multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, 'uploads/'),
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${folder}-${uuidv4()}${ext}`);
      },
    }),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 },
  });

const getUploader = (folder) => {
  if (isCloudinaryConfigured()) {
    return uploadToCloudinary(folder);
  }
  return uploadToDisk(folder);
};

// Extract URL from an uploaded file — handles Cloudinary, S3, and disk storage
const getFileUrl = (file) => {
  if (!file) return null;
  if (file.path && file.path.startsWith('http')) return file.path; // Cloudinary secure_url
  if (file.location) return file.location;                          // S3 (legacy)
  if (file.filename) return `/uploads/${file.filename}`;            // local disk
  return null;
};

module.exports = { getUploader, getFileUrl };

const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDFs are allowed'), false);
  }
};

const uploadToS3 = (folder) =>
  multer({
    storage: multerS3({
      s3,
      bucket: process.env.AWS_BUCKET_NAME,
      metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
      key: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${folder}/${uuidv4()}${ext}`);
      },
    }),
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
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
  if (
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_ACCESS_KEY_ID !== 'placeholder'
  ) {
    return uploadToS3(folder);
  }
  return uploadToDisk(folder);
};

module.exports = { getUploader };

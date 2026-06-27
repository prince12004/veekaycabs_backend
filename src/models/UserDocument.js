const mongoose = require('mongoose');

const docStatus = ['not_uploaded', 'pending', 'verified', 'rejected', 'mismatch', 'expired'];

const UserDocumentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  aadhaar: {
    number: String,
    maskedNumber: String,
    front: String,
    back: String,
    name: String,
    dob: String,
    address: String,
    status: { type: String, enum: docStatus, default: 'not_uploaded' },
    verifiedAt: Date,
    rejectedReason: String,
  },
  pan: {
    number: String,
    photo: String,
    name: String,
    status: { type: String, enum: docStatus, default: 'not_uploaded' },
    verifiedAt: Date,
    rejectedReason: String,
  },
  dl: {
    number: String,
    front: String,
    back: String,
    dob: String,
    name: String,
    validity: Date,
    issueDate: Date,
    classes: [String],
    status: { type: String, enum: docStatus, default: 'not_uploaded' },
    verifiedAt: Date,
    rejectedReason: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('UserDocument', UserDocumentSchema);

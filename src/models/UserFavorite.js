const mongoose = require('mongoose');

const UserFavoriteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  carId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Car', required: true },
}, { timestamps: true });

UserFavoriteSchema.index({ userId: 1, carId: 1 }, { unique: true });
module.exports = mongoose.model('UserFavorite', UserFavoriteSchema);

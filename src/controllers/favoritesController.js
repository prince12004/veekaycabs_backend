const UserFavorite = require('../models/UserFavorite');

const getMyFavorites = async (req, res) => {
  try {
    const favs = await UserFavorite.find({ userId: req.user._id })
      .populate('carId', 'name slug type fuel seats images regularPrice cityId')
      .sort({ createdAt: -1 });
    return res.json({ success: true, data: favs.map(f => f.carId) });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to fetch favorites' });
  }
};

const toggleFavorite = async (req, res) => {
  try {
    const { carId } = req.body;
    if (!carId) return res.status(400).json({ success: false, message: 'carId required' });
    const existing = await UserFavorite.findOne({ userId: req.user._id, carId });
    if (existing) {
      await existing.deleteOne();
      return res.json({ success: true, action: 'removed', message: 'Removed from favorites' });
    }
    await UserFavorite.create({ userId: req.user._id, carId });
    return res.json({ success: true, action: 'added', message: 'Added to favorites' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to toggle favorite' });
  }
};

module.exports = { getMyFavorites, toggleFavorite };

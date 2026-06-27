const City = require('../models/City');

// GET /api/cities
const getCities = async (req, res) => {
  try {
    const cities = await City.find({ isActive: true }).select('name slug pickupLocations deliveryCharge state');
    return res.json({ success: true, data: cities });
  } catch (error) {
    console.error('getCities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch cities' });
  }
};

module.exports = { getCities };

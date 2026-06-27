const City = require('../../models/City');

// GET /api/admin/cities
const getAllCities = async (req, res) => {
  try {
    const cities = await City.find({}).sort({ name: 1 });
    return res.json({ success: true, data: cities });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch cities' });
  }
};

// POST /api/admin/cities
const createCity = async (req, res) => {
  try {
    const { name, slug, state, pickupLocations, deliveryCharge } = req.body;
    const resolvedSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const city = await City.create({ name, slug: resolvedSlug, state, pickupLocations, deliveryCharge });
    return res.status(201).json({ success: true, data: city });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'City slug already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create city' });
  }
};

// PUT /api/admin/cities/:id
const updateCity = async (req, res) => {
  try {
    const city = await City.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true,
    });
    if (!city) return res.status(404).json({ success: false, message: 'City not found' });
    return res.json({ success: true, data: city });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update city' });
  }
};

// DELETE /api/admin/cities/:id
const deleteCity = async (req, res) => {
  try {
    const city = await City.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!city) return res.status(404).json({ success: false, message: 'City not found' });
    return res.json({ success: true, message: 'City deactivated successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to deactivate city' });
  }
};

module.exports = { getAllCities, createCity, updateCity, deleteCity };

const Car = require('../../models/Car');
const { getFileUrl } = require('../../middleware/upload');

// GET /api/admin/cars
const getAllCars = async (req, res) => {
  try {
    const { city, type, isActive, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (city) filter.cityId = city;
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const total = await Car.countDocuments(filter);
    const cars = await Car.find(filter)
      .populate('cityId', 'name slug')
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    return res.json({
      success: true,
      data: cars,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('admin getAllCars error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch cars' });
  }
};

// GET /api/admin/cars/:id
const getCarById = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id).populate('cityId', 'name slug');
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });
    return res.json({ success: true, data: car });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch car' });
  }
};

// POST /api/admin/cars
const createCar = async (req, res) => {
  try {
    const {
      name, registrationNo, modelYear, type, fuel, transmission,
      seats, regularPrice, weekendPrice, securityDeposit, doorstepDeliveryCharge, kmPackage,
      cityId, gpsDeviceId, features,
    } = req.body;

    const images = (req.files || []).map(getFileUrl).filter(Boolean);
    let documents = {};
    if (req.body.documents) {
      try { documents = JSON.parse(req.body.documents); } catch {}
    }

    const car = await Car.create({
      name, registrationNo, modelYear, type, fuel, transmission,
      seats, regularPrice, weekendPrice, securityDeposit, doorstepDeliveryCharge, kmPackage,
      cityId, gpsDeviceId, images, documents,
      features: typeof features === 'string' ? JSON.parse(features) : features || [],
    });

    const populated = await Car.findById(car._id).populate('cityId', 'name slug');
    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('admin createCar error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Registration number already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create car' });
  }
};

// PUT /api/admin/cars/:id
const updateCar = async (req, res) => {
  try {
    const existing = await Car.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Car not found' });

    const allowedFields = [
      'name', 'registrationNo', 'modelYear', 'type', 'fuel', 'transmission', 'seats',
      'regularPrice', 'weekendPrice', 'securityDeposit', 'doorstepDeliveryCharge', 'kmPackage',
      'cityId', 'gpsDeviceId', 'features', 'documents', 'isActive',
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (field === 'documents' && typeof req.body[field] === 'string') {
          try { updates[field] = JSON.parse(req.body[field]); } catch {}
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    let removeImages = [];
    if (req.body.removeImages) {
      try { removeImages = JSON.parse(req.body.removeImages); } catch {}
    }
    const newImages = (req.files || []).map(getFileUrl).filter(Boolean);

    if (removeImages.length > 0 || newImages.length > 0) {
      const finalImages = existing.images
        .filter((img) => !removeImages.includes(img))
        .concat(newImages);

      if (finalImages.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one image is required' });
      }
      updates.images = finalImages;
    }

    const car = await Car.findByIdAndUpdate(req.params.id, updates, {
      new: true, runValidators: true,
    }).populate('cityId', 'name slug');

    return res.json({ success: true, data: car });
  } catch (error) {
    console.error('admin updateCar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update car' });
  }
};

// DELETE /api/admin/cars/:id  (soft delete)
const deleteCar = async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });
    return res.json({ success: true, message: 'Car deactivated successfully' });
  } catch (error) {
    console.error('admin deleteCar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete car' });
  }
};

// PATCH /api/admin/cars/:id/toggle
const toggleCarStatus = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    car.isActive = !car.isActive;
    await car.save();

    return res.json({
      success: true,
      data: { _id: car._id, isActive: car.isActive },
      message: `Car ${car.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    console.error('admin toggleCarStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to toggle car status' });
  }
};

// GET /api/admin/cars/expiry-alerts
const getExpiryAlerts = async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const cars = await Car.find({ isActive: true }).populate('cityId', 'name');

    const alerts = [];
    cars.forEach((car) => {
      const docTypes = ['insurance', 'puc', 'fitness', 'roadTax', 'rc'];
      docTypes.forEach((docType) => {
        const doc = car.documents?.[docType];
        if (doc?.expiry) {
          const expiry = new Date(doc.expiry);
          if (expiry <= thirtyDaysFromNow) {
            const isExpired = expiry < now;
            alerts.push({
              carId: car._id,
              carName: car.name,
              registrationNo: car.registrationNo,
              city: car.cityId?.name,
              docType,
              expiry: doc.expiry,
              status: isExpired ? 'expired' : 'expiring_soon',
              daysLeft: Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)),
            });
          }
        }
      });
    });

    alerts.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

    return res.json({ success: true, data: alerts, total: alerts.length });
  } catch (error) {
    console.error('admin getExpiryAlerts error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch expiry alerts' });
  }
};

// PATCH /api/admin/cars/:id/documents/:docType
const uploadCarDocument = async (req, res) => {
  try {
    const { id, docType } = req.params;
    const allowed = ['rc', 'insurance', 'puc', 'fitness', 'roadTax'];
    if (!allowed.includes(docType)) {
      return res.status(400).json({ success: false, message: 'Invalid doc type' });
    }

    const car = await Car.findById(id);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    if (!car.documents) car.documents = {};
    if (!car.documents[docType]) car.documents[docType] = {};

    if (req.file) {
      car.documents[docType].url = getFileUrl(req.file);
    }
    if (req.body.expiry) {
      car.documents[docType].expiry = new Date(req.body.expiry);
    }

    car.markModified('documents');
    await car.save();

    return res.json({ success: true, data: car.documents });
  } catch (error) {
    console.error('uploadCarDocument error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

module.exports = { getAllCars, getCarById, createCar, updateCar, deleteCar, toggleCarStatus, getExpiryAlerts, uploadCarDocument };

const Car = require('../../models/Car');
const { getFileUrl } = require('../../middleware/upload');

const EXPIRY_ALERT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

const expiryAlertCondition = () => ({
  isActive: true,
  $or: [
    { 'documents.insurance.expiry': { $ne: null, $lte: new Date(Date.now() + EXPIRY_ALERT_WINDOW_MS) } },
    { 'documents.puc.expiry': { $ne: null, $lte: new Date(Date.now() + EXPIRY_ALERT_WINDOW_MS) } },
  ],
});

// GET /api/admin/cars
const getAllCars = async (req, res) => {
  try {
    const { city, type, isActive, search, expiryAlert, fields, page = 1, limit = 20 } = req.query;
    const conditions = [{ isDeleted: { $ne: true } }];
    if (city) conditions.push({ cityId: city });
    if (type) conditions.push({ type });
    if (isActive !== undefined) conditions.push({ isActive: isActive === 'true' });
    if (search) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      conditions.push({ $or: [{ name: regex }, { registrationNo: regex }] });
    }
    // Matches the "critical" definition used for the fleet expiry-alert
    // badge: active cars with insurance/PUC already expired or expiring
    // within 14 days.
    if (expiryAlert === 'true') conditions.push(expiryAlertCondition());
    const filter = conditions.length ? { $and: conditions } : {};

    // limit=all fetches the entire matching set unpaginated — for pickers
    // (offline booking car select, document manager) that need every car
    // and would otherwise silently drop cars past a fixed page size once
    // the fleet outgrows it.
    const noLimit = limit === 'all';
    const parsedLimit = noLimit ? 0 : Math.max(parseInt(limit) || 20, 1);
    const parsedPage = Math.max(parseInt(page) || 1, 1);

    // Callers that only need a few fields (e.g. a car picker dropdown) can
    // request them explicitly to avoid shipping images/documents/features
    // over the wire for every row.
    let query = Car.find(filter);
    if (fields) query = query.select(fields.split(',').join(' '));
    else query = query.populate('cityId', 'name slug');

    query = query.sort({ createdAt: -1 });
    if (!noLimit) query = query.skip((parsedPage - 1) * parsedLimit).limit(parsedLimit);

    const [total, activeCount, cars] = await Promise.all([
      Car.countDocuments(filter),
      Car.countDocuments({ ...filter, isActive: true }),
      query.lean(),
    ]);

    return res.json({
      success: true,
      data: cars,
      total,
      activeCount,
      inactiveCount: total - activeCount,
      page: parsedPage,
      pages: noLimit ? 1 : (Math.ceil(total / parsedLimit) || 1),
    });
  } catch (error) {
    console.error('admin getAllCars error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch cars' });
  }
};

// GET /api/admin/cars/stats — lightweight counts + city list for the fleet
// page's summary tiles/filter dropdown, without shipping full car documents.
const getCarStats = async (req, res) => {
  try {
    const [total, activeCount, cities, criticalExpiry] = await Promise.all([
      Car.countDocuments({ isDeleted: { $ne: true } }),
      Car.countDocuments({ isActive: true }),
      Car.aggregate([
        { $match: { cityId: { $ne: null }, isDeleted: { $ne: true } } },
        { $group: { _id: '$cityId' } },
        { $lookup: { from: 'cities', localField: '_id', foreignField: '_id', as: 'city' } },
        { $unwind: '$city' },
        { $project: { _id: 0, id: '$_id', name: '$city.name' } },
        { $sort: { name: 1 } },
      ]),
      Car.countDocuments(expiryAlertCondition()),
    ]);

    return res.json({
      success: true,
      total,
      activeCount,
      inactiveCount: total - activeCount,
      criticalExpiry,
      cities,
    });
  } catch (error) {
    console.error('admin getCarStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch fleet stats' });
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
      seats, regularPrice, weekendPrice, securityDeposit, doorstepDeliveryCharge, kmPackage, extraKmRate,
      cityId, gpsDeviceId, features, odometer,
    } = req.body;

    const images = (req.files || []).map(getFileUrl).filter(Boolean);
    let documents = {};
    if (req.body.documents) {
      try { documents = JSON.parse(req.body.documents); } catch {}
    }
    let maintenance = {};
    if (req.body.maintenance) {
      try { maintenance = JSON.parse(req.body.maintenance); } catch {}
    }

    const car = await Car.create({
      name, registrationNo, modelYear, type, fuel, transmission,
      seats, regularPrice, weekendPrice, securityDeposit, doorstepDeliveryCharge, kmPackage, extraKmRate,
      cityId, gpsDeviceId, images, documents, odometer, maintenance,
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
      'regularPrice', 'weekendPrice', 'securityDeposit', 'doorstepDeliveryCharge', 'kmPackage', 'extraKmRate',
      'cityId', 'gpsDeviceId', 'features', 'documents', 'isActive', 'odometer', 'maintenance',
    ];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if ((field === 'documents' || field === 'maintenance') && typeof req.body[field] === 'string') {
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

// PATCH /api/admin/cars/bulk-price — update pricing fields for every car
// matching a given model name and/or type in one shot, instead of editing
// each car individually.
const bulkUpdatePrice = async (req, res) => {
  try {
    const { name, type, regularPrice, weekendPrice, extraKmRate, securityDeposit, doorstepDeliveryCharge } = req.body;
    if (!name && !type) {
      return res.status(400).json({ success: false, message: 'Select a car name or type to update' });
    }

    const filter = { isDeleted: { $ne: true } };
    if (name) filter.name = name;
    if (type) filter.type = type;

    const updates = {};
    [
      ['regularPrice', regularPrice],
      ['weekendPrice', weekendPrice],
      ['extraKmRate', extraKmRate],
      ['securityDeposit', securityDeposit],
      ['doorstepDeliveryCharge', doorstepDeliveryCharge],
    ].forEach(([field, value]) => {
      if (value !== undefined && value !== '') updates[field] = Number(value);
    });
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Enter at least one price field to update' });
    }

    const matchedCount = await Car.countDocuments(filter);
    if (matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'No cars match that name/type' });
    }

    const result = await Car.updateMany(filter, { $set: updates }, { runValidators: true });
    return res.json({
      success: true,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      updates,
    });
  } catch (error) {
    console.error('admin bulkUpdatePrice error:', error);
    return res.status(500).json({ success: false, message: 'Failed to bulk update prices' });
  }
};

// DELETE /api/admin/cars/:id — soft delete: hides it from the admin list and
// public site. Distinct from Deactivate (isActive alone), and clears any
// scheduled inactivePeriod so the every-minute cron can't flip isActive back
// on and inadvertently resurface a deleted car.
const deleteCar = async (req, res) => {
  try {
    const car = await Car.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false, isDeleted: true }, $unset: { inactivePeriod: 1 } },
      { new: true }
    );
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });
    return res.json({ success: true, message: 'Car deleted successfully' });
  } catch (error) {
    console.error('admin deleteCar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete car' });
  }
};

// Bare "YYYY-MM-DD" strings are parsed as UTC midnight by `new Date()`, which
// drifts against server-local "now" (e.g. IST is UTC+5:30) — a date picked as
// "today" could compare as being hours in the future. Parsing with an
// explicit local time avoids that drift. `endOfDay` is used for "to" so the
// car stays inactive through the whole selected day, not just until its start.
const parseLocalDate = (str, endOfDay = false) => {
  if (!str) return null;
  const bareDate = /^\d{4}-\d{2}-\d{2}$/.test(str);
  if (bareDate) return new Date(`${str}T${endOfDay ? '23:59:59.999' : '00:00:00'}`);
  return new Date(str);
};

// PATCH /api/admin/cars/:id/toggle — deactivating requires a reason and
// accepts an optional from/to date range. If "from" is a future date the
// car stays active until then (a cron job flips it off/on automatically —
// see server.js); if "from" is today or omitted it deactivates right away.
const toggleCarStatus = async (req, res) => {
  try {
    const existing = await Car.findById(req.params.id, 'isActive');
    if (!existing) return res.status(404).json({ success: false, message: 'Car not found' });

    const willActivate = !existing.isActive;
    let update;
    let message;

    if (willActivate) {
      update = { $set: { isActive: true }, $unset: { inactivePeriod: 1 } };
      message = 'Car activated successfully';
    } else {
      const { from, to, reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'A reason is required to deactivate a car' });
      }
      const fromDate = parseLocalDate(from) || new Date();
      const toDate = parseLocalDate(to, true);
      if (toDate && toDate < fromDate) {
        return res.status(400).json({ success: false, message: '"To" date cannot be before "From" date' });
      }

      const startsInFuture = fromDate > new Date();

      update = {
        $set: {
          // Stays active/bookable right up until the scheduled "from" date arrives.
          isActive: !startsInFuture,
          inactivePeriod: {
            from: fromDate,
            to: toDate || undefined,
            reason: reason.trim(),
          },
        },
      };
      message = startsInFuture
        ? `Car will automatically go inactive from ${fromDate.toDateString()}`
        : 'Car deactivated successfully';
    }

    const car = await Car.findByIdAndUpdate(req.params.id, update, { new: true });

    return res.json({
      success: true,
      data: { _id: car._id, isActive: car.isActive, inactivePeriod: car.inactivePeriod },
      message,
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

    // "Due soon" window for km-based maintenance, analogous to the 30-day
    // window used for document expiry above.
    const MAINTENANCE_WINDOW_KM = 1000;

    const alerts = [];
    cars.forEach((car) => {
      const docTypes = ['insurance', 'puc', 'fitness', 'roadTax', 'rc', 'permit'];
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

      [
        { docType: 'service', intervalKm: car.maintenance?.serviceIntervalKm, lastKm: car.maintenance?.lastServiceKm },
        { docType: 'alignment', intervalKm: car.maintenance?.alignmentIntervalKm, lastKm: car.maintenance?.lastAlignmentKm },
      ].forEach(({ docType, intervalKm, lastKm }) => {
        if (!intervalKm) return;
        const dueAtKm = (lastKm || 0) + intervalKm;
        const kmLeft = dueAtKm - (car.odometer || 0);
        if (kmLeft <= MAINTENANCE_WINDOW_KM) {
          alerts.push({
            carId: car._id,
            carName: car.name,
            registrationNo: car.registrationNo,
            city: car.cityId?.name,
            docType,
            dueAtKm,
            status: kmLeft < 0 ? 'expired' : 'expiring_soon',
            kmLeft,
          });
        }
      });
    });

    alerts.sort((a, b) => {
      const aVal = a.expiry ? new Date(a.expiry).getTime() : Date.now() + a.kmLeft * 1000;
      const bVal = b.expiry ? new Date(b.expiry).getTime() : Date.now() + b.kmLeft * 1000;
      return aVal - bVal;
    });

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

module.exports = { getAllCars, getCarStats, getCarById, createCar, updateCar, deleteCar, toggleCarStatus, getExpiryAlerts, uploadCarDocument, bulkUpdatePrice };

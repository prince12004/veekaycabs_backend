const MaintenanceLog = require('../../models/MaintenanceLog');
const Car = require('../../models/Car');

// GET /api/admin/maintenance?carId=&category=&month=YYYY-MM&page=&limit=
const getAll = async (req, res) => {
  try {
    const { carId, category, month, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (carId) filter.carId = carId;
    if (category) filter.category = category;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      filter.date = { $gte: start, $lt: end };
    }

    const [total, logs, totalSpentResult, byCategoryResult] = await Promise.all([
      MaintenanceLog.countDocuments(filter),
      MaintenanceLog.find(filter)
        .populate('carId', 'name registrationNo')
        .sort({ date: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      MaintenanceLog.aggregate([{ $match: filter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      MaintenanceLog.aggregate([
        { $match: filter },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    return res.json({
      success: true,
      data: logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      totalSpent: totalSpentResult[0]?.total || 0,
      byCategory: byCategoryResult.map((c) => ({ category: c._id, total: c.total, count: c.count })),
    });
  } catch (error) {
    console.error('admin getMaintenanceLogs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch maintenance logs' });
  }
};

// GET /api/admin/maintenance/by-car?month=YYYY-MM — total spent & entry count per car, for the maintenance car-picker
const getTotalsByCar = async (req, res) => {
  try {
    const { month } = req.query;
    const match = {};
    if (month) {
      const [y, m] = month.split('-').map(Number);
      match.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
    }

    const [totals, overallResult] = await Promise.all([
      MaintenanceLog.aggregate([
        { $match: match },
        { $group: { _id: '$carId', total: { $sum: '$amount' }, count: { $sum: 1 }, lastDate: { $max: '$date' } } },
      ]),
      MaintenanceLog.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    ]);

    return res.json({
      success: true,
      data: totals.map((t) => ({ carId: t._id, total: t.total, count: t.count, lastDate: t.lastDate })),
      overallTotal: overallResult[0]?.total || 0,
      overallCount: overallResult[0]?.count || 0,
    });
  } catch (error) {
    console.error('admin getMaintenanceTotalsByCar error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch maintenance totals' });
  }
};

// POST /api/admin/maintenance
const create = async (req, res) => {
  try {
    const { carId, category, amount, odometer, remark, date } = req.body;
    if (!carId || !amount) {
      return res.status(400).json({ success: false, message: 'carId and amount are required' });
    }

    const car = await Car.findById(carId);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    const log = await MaintenanceLog.create({
      carId,
      category: category || 'Other',
      amount,
      odometer: odometer || undefined,
      remark,
      date: date || new Date(),
    });

    // Keep the car's odometer in sync if this entry reports a newer reading
    if (odometer && odometer > (car.odometer || 0)) {
      car.odometer = odometer;
      await car.save();
    }

    const populated = await MaintenanceLog.findById(log._id).populate('carId', 'name registrationNo');
    return res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('admin createMaintenanceLog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to add maintenance entry' });
  }
};

// PUT /api/admin/maintenance/:id
const update = async (req, res) => {
  try {
    const allowedFields = ['category', 'amount', 'odometer', 'remark', 'date'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const log = await MaintenanceLog.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true })
      .populate('carId', 'name registrationNo');
    if (!log) return res.status(404).json({ success: false, message: 'Entry not found' });

    return res.json({ success: true, data: log });
  } catch (error) {
    console.error('admin updateMaintenanceLog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update maintenance entry' });
  }
};

// DELETE /api/admin/maintenance/:id
const remove = async (req, res) => {
  try {
    const log = await MaintenanceLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ success: false, message: 'Entry not found' });
    return res.json({ success: true, message: 'Maintenance entry deleted' });
  } catch (error) {
    console.error('admin deleteMaintenanceLog error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete maintenance entry' });
  }
};

module.exports = { getAll, getTotalsByCar, create, update, remove };

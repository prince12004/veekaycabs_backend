const Car = require('../../models/Car');
const { isQuickEkycConfigured, verifyRC, checkChallan } = require('../../services/quickekyc');

// Normalizes the (currently best-guess) QuickEKYC RC response into our schema.
// TODO: adjust field mapping once the real QuickEKYC response shape is confirmed.
const normalizeRcResult = (apiData) => ({
  status: 'verified',
  ownerName: apiData?.owner_name || apiData?.ownerName || null,
  registrationDate: apiData?.registration_date ? new Date(apiData.registration_date) : null,
  vehicleClass: apiData?.vehicle_class || apiData?.class || null,
  chassisNumber: apiData?.chassis_number || null,
  engineNumber: apiData?.engine_number || null,
  insuranceValidUpto: apiData?.insurance_upto ? new Date(apiData.insurance_upto) : null,
  fitnessValidUpto: apiData?.fitness_upto ? new Date(apiData.fitness_upto) : null,
  pucValidUpto: apiData?.puc_upto ? new Date(apiData.puc_upto) : null,
  taxValidUpto: apiData?.tax_upto ? new Date(apiData.tax_upto) : null,
  rcStatus: apiData?.rc_status || apiData?.status || null,
  raw: apiData,
  analyzedAt: new Date(),
  error: undefined,
});

// TODO: adjust field mapping once the real QuickEKYC challan response shape is confirmed.
const normalizeChallanResult = (apiData) => {
  const rawList = apiData?.challans || apiData?.challan_details || apiData?.data || [];
  const challans = (Array.isArray(rawList) ? rawList : []).map((c) => ({
    challanNumber: c.challan_number || c.challanNumber || null,
    challanDate: c.challan_date ? new Date(c.challan_date) : null,
    amount: Number(c.amount) || 0,
    status: c.status || null,
    offense: c.offense || c.violation || null,
    location: c.location || null,
  }));
  return {
    status: 'checked',
    totalChallans: challans.length,
    totalPendingAmount: challans
      .filter((c) => (c.status || '').toLowerCase() === 'pending')
      .reduce((sum, c) => sum + (c.amount || 0), 0),
    challans,
    raw: apiData,
    analyzedAt: new Date(),
    error: undefined,
  };
};

// ─── POST /api/admin/cars/:id/verify-rc ──────────────────────────────────────
// Pass { force: true } in the body (or ?force=true) to bypass cache and re-run.
const verifyCarRC = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    const force = req.body?.force === true || req.query.force === 'true';
    if (!force && car.rcVerification?.analyzedAt) {
      return res.json({ success: true, data: car.rcVerification, cached: true });
    }

    if (!isQuickEkycConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'RC verification not configured. Add QUICKEKYC_API_KEY in server .env.',
      });
    }

    const result = await verifyRC(car.registrationNo);
    if (!result.success) {
      car.rcVerification = {
        status: 'failed',
        error: result.error || 'RC verification failed',
        analyzedAt: new Date(),
      };
      await car.save();
      return res.status(502).json({ success: false, message: result.error || 'RC verification failed', data: car.rcVerification });
    }

    const normalized = normalizeRcResult(result.data);
    car.rcVerification = normalized;
    await car.save();

    return res.json({ success: true, data: normalized, cached: false });
  } catch (error) {
    console.error('verifyCarRC error:', error);
    return res.status(500).json({ success: false, message: 'RC verification failed' });
  }
};

// ─── POST /api/admin/cars/:id/check-challan ──────────────────────────────────
// Pass { force: true } in the body (or ?force=true) to bypass cache and re-run.
const checkCarChallan = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    const force = req.body?.force === true || req.query.force === 'true';
    if (!force && car.challanCheck?.analyzedAt) {
      return res.json({ success: true, data: car.challanCheck, cached: true });
    }

    if (!isQuickEkycConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Challan check not configured. Add QUICKEKYC_API_KEY in server .env.',
      });
    }

    const result = await checkChallan(car.registrationNo);
    if (!result.success) {
      car.challanCheck = {
        status: 'failed',
        error: result.error || 'Challan check failed',
        analyzedAt: new Date(),
      };
      await car.save();
      return res.status(502).json({ success: false, message: result.error || 'Challan check failed', data: car.challanCheck });
    }

    const normalized = normalizeChallanResult(result.data);
    car.challanCheck = normalized;
    await car.save();

    return res.json({ success: true, data: normalized, cached: false });
  } catch (error) {
    console.error('checkCarChallan error:', error);
    return res.status(500).json({ success: false, message: 'Challan check failed' });
  }
};

module.exports = { verifyCarRC, checkCarChallan };

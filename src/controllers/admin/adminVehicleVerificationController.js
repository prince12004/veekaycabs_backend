const Car = require('../../models/Car');
const VehicleCheck = require('../../models/VehicleCheck');
const { isQuickEkycConfigured, isSurepassConfigured, isRcConfigured, verifyRC, checkChallan } = require('../../services/quickekyc');

const parseDate = (d) => {
  if (!d) return null;
  // QuickEKYC returns dates as "DD-MM-YYYY" strings
  const [day, month, year] = String(d).split('-');
  if (day && month && year) return new Date(`${year}-${month}-${day}`);
  return new Date(d);
};

const normalizeRcResult = (apiData) => ({
  status: 'verified',
  ownerName: apiData?.owner_name || null,
  fatherName: apiData?.father_name || null,
  presentAddress: apiData?.present_address || null,
  permanentAddress: apiData?.permanent_address || null,
  registrationDate: apiData?.registration_date ? parseDate(apiData.registration_date) : null,
  rcStatus: apiData?.rc_status || null,
  ownerNumber: apiData?.owner_number || null,
  rtoCode: apiData?.rto_code || null,
  registeredAt: apiData?.registered_at || null,
  vehicleClass: apiData?.vehicle_category || apiData?.vehicle_category_description || null,
  vehicleModel: apiData?.maker_model || null,
  makerDescription: apiData?.maker_description || null,
  bodyType: apiData?.body_type || null,
  fuelType: apiData?.fuel_type || null,
  color: apiData?.color || null,
  seatCapacity: apiData?.seat_capacity ? Number(apiData.seat_capacity) : null,
  cubicCapacity: apiData?.cubic_capacity || null,
  manufacturingDate: apiData?.manufacturing_date_formatted || apiData?.manufacturing_date || null,
  chassisNumber: apiData?.vehicle_chasi_number || apiData?.chassis_number || null,
  engineNumber: apiData?.vehicle_engine_number || apiData?.engine_number || null,
  insuranceCompany: apiData?.insurance_company || null,
  insurancePolicyNumber: apiData?.insurance_policy_number || null,
  insuranceValidUpto: apiData?.insurance_upto ? parseDate(apiData.insurance_upto) : null,
  fitnessValidUpto: apiData?.fit_up_to ? parseDate(apiData.fit_up_to) : null,
  taxUpto: apiData?.tax_upto ? parseDate(apiData.tax_upto) : null,
  puccUpto: apiData?.pucc_upto ? parseDate(apiData.pucc_upto) : null,
  financer: apiData?.financer || null,
  blacklistStatus: apiData?.blacklist_status || null,
  raw: apiData,
  analyzedAt: new Date(),
  error: undefined,
});

const normalizeChallanResult = (apiData) => {
  const rawList = apiData?.challan_data || [];
  const challans = (Array.isArray(rawList) ? rawList : []).map((c) => ({
    challanNumber: c.challan_no || null,
    challanDate: c.challan_time ? new Date(c.challan_time) : null,
    amount: Number(c.challan_amount) || 0,
    status: c.challan_status || null,
    offense: c.challan_info || null,
    location: c.challan_place || c.state_code || null,
  }));
  return {
    status: 'checked',
    ownerName: apiData?.owner_name || null,
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
// QuickEKYC's RC Advance endpoint requires both { chassisNumber, engineNumber }
// (last 5 chars each).
const verifyCarRC = async (req, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) return res.status(404).json({ success: false, message: 'Car not found' });

    const force = req.body?.force === true || req.query.force === 'true';
    if (!force && car.rcVerification?.analyzedAt) {
      return res.json({ success: true, data: car.rcVerification, cached: true });
    }

    if (!isRcConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'RC verification not configured. Add QUICKEKYC_API_KEY in server .env.',
      });
    }

    const chassisNumber = String(req.body?.chassisNumber || '').trim();
    const engineNumber = String(req.body?.engineNumber || '').trim();

    const result = await verifyRC(car.registrationNo, chassisNumber, engineNumber);
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

// ─── POST /api/admin/vehicle-verification/rc ─────────────────────────────────
// RC verification for ANY registration number, fleet or not — logged to the
// VehicleCheck collection (keyed by registrationNo) so results are cached and
// show up in the "Checked Vehicles" list. Pass { registrationNo, chassisNumber,
// engineNumber, force? } — both chassisNumber and engineNumber (last 5 chars
// each) are required by QuickEKYC's RC Advance endpoint.
const verifyRcStandalone = async (req, res) => {
  try {
    const registrationNo = String(req.body?.registrationNo || '').trim().toUpperCase();
    if (!registrationNo) return res.status(400).json({ success: false, message: 'registrationNo is required' });

    const force = req.body?.force === true;
    let entry = await VehicleCheck.findOne({ registrationNo });
    if (!force && entry?.rcVerification?.analyzedAt) {
      return res.json({ success: true, data: entry.rcVerification, cached: true });
    }

    if (!isRcConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'RC verification not configured. Add QUICKEKYC_API_KEY in server .env.',
      });
    }

    // Chassis/engine are optional for QuickEKYC RC Special v1 but improve match accuracy
    const chassisNumber = String(req.body?.chassisNumber || '').trim();
    const engineNumber = String(req.body?.engineNumber || '').trim();

    if (!entry) entry = new VehicleCheck({ registrationNo });

    const result = await verifyRC(registrationNo, chassisNumber, engineNumber);
    if (!result.success) {
      entry.rcVerification = { status: 'failed', error: result.error || 'RC verification failed', analyzedAt: new Date() };
      await entry.save();
      return res.status(502).json({ success: false, message: result.error || 'RC verification failed', data: entry.rcVerification });
    }

    const normalized = normalizeRcResult(result.data);
    entry.rcVerification = normalized;
    await entry.save();

    return res.json({ success: true, data: normalized, cached: false });
  } catch (error) {
    console.error('verifyRcStandalone error:', error);
    return res.status(500).json({ success: false, message: 'RC verification failed' });
  }
};

// ─── POST /api/admin/vehicle-verification/challan ────────────────────────────
// Challan check for ANY registration number, fleet or not — logged the same
// way as verifyRcStandalone. Pass { registrationNo, force? }.
const checkChallanStandalone = async (req, res) => {
  try {
    const registrationNo = String(req.body?.registrationNo || '').trim().toUpperCase();
    if (!registrationNo) return res.status(400).json({ success: false, message: 'registrationNo is required' });

    const force = req.body?.force === true;
    let entry = await VehicleCheck.findOne({ registrationNo });
    if (!force && entry?.challanCheck?.analyzedAt) {
      return res.json({ success: true, data: entry.challanCheck, cached: true });
    }

    if (!isQuickEkycConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Challan check not configured. Add QUICKEKYC_API_KEY in server .env.',
      });
    }

    if (!entry) entry = new VehicleCheck({ registrationNo });

    const result = await checkChallan(registrationNo);
    if (!result.success) {
      entry.challanCheck = { status: 'failed', error: result.error || 'Challan check failed', analyzedAt: new Date() };
      await entry.save();
      return res.status(502).json({ success: false, message: result.error || 'Challan check failed', data: entry.challanCheck });
    }

    const normalized = normalizeChallanResult(result.data);
    entry.challanCheck = normalized;
    await entry.save();

    return res.json({ success: true, data: normalized, cached: false });
  } catch (error) {
    console.error('checkChallanStandalone error:', error);
    return res.status(500).json({ success: false, message: 'Challan check failed' });
  }
};

// ─── GET /api/admin/vehicle-verification ─────────────────────────────────────
// Lists every registration number checked from this tool, most recent first.
// Supports ?page=1&limit=20 pagination.
const listVehicleChecks = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const filter = {
      $or: [{ 'rcVerification.analyzedAt': { $ne: null } }, { 'challanCheck.analyzedAt': { $ne: null } }],
    };

    const [total, entries] = await Promise.all([
      VehicleCheck.countDocuments(filter),
      VehicleCheck.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      success: true,
      data: entries,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('listVehicleChecks error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch checked vehicles' });
  }
};

module.exports = { verifyCarRC, checkCarChallan, verifyRcStandalone, checkChallanStandalone, listVehicleChecks };

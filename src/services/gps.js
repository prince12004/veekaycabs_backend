const axios = require('axios');

// ─── Millitrack (Uffizio) vehicle tracking ────────────────────────────────────
const MILLITRACK_URL = 'https://mvts1.millitrack.com/api/middleMan/getDeviceInfo';

const isConfigured = () =>
  !!process.env.UFFIZIO_API_KEY && process.env.UFFIZIO_API_KEY !== 'placeholder';

// Real trackers report a 15-digit IMEI. Cars without a physical device fitted
// yet are seeded with placeholder ids (e.g. "GPS002") — Millitrack rejects the
// *entire* batch request if even one non-IMEI id is mixed in, which was
// knocking every car offline. Filter those out before calling the API.
const isValidImei = (imei) => /^\d{15}$/.test(imei);

// Millitrack blocks IPs that poll faster than every 10s, so cache the raw
// response for slightly longer than that regardless of which IMEIs are asked
// for — the admin GPS page always requests the full fleet anyway.
const CACHE_TTL_MS = 12000;
let cache = { map: new Map(), fetchedAt: 0 };

// Returns a Map<deviceUniqueId, deviceObject> for the given IMEIs.
const getLiveLocations = async (imeis = []) => {
  const validImeis = imeis.filter(isValidImei);
  if (!isConfigured() || validImeis.length === 0) return new Map();

  if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.map;
  }

  const params = new URLSearchParams({ accessToken: process.env.UFFIZIO_API_KEY });
  validImeis.forEach((imei) => params.append('imei', imei));

  try {
    const res = await axios.get(`${MILLITRACK_URL}?${params.toString()}`, { timeout: 10000 });
    const map = new Map();
    if (res.data?.successful && res.data.object) {
      // Millitrack returns a single object (not an array) when only one device matches
      const devices = Array.isArray(res.data.object) ? res.data.object : [res.data.object];
      for (const device of devices) {
        map.set(device.deviceUniqueId, device);
      }
    }
    cache = { map, fetchedAt: Date.now() };
    return map;
  } catch (error) {
    console.error('[GPS] Millitrack fetch error:', error.response?.data || error.message);
    return cache.map;
  }
};

// ─── Reverse geocoding ─────────────────────────────────────────────────────
// Millitrack never populates device.address for this account, so resolve a
// human-readable address ourselves from lat/lng via OSM Nominatim (free, no
// API key). Cache by rounded coordinates (~11m) since parked/idle cars would
// otherwise re-geocode the same spot every poll.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const GEOCODE_CACHE_TTL_MS = 5 * 60 * 1000;
const geocodeCache = new Map(); // key -> { address, expiresAt }

const getAddress = async (lat, lng) => {
  if (lat == null || lng == null) return null;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = geocodeCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.address;

  try {
    const res = await axios.get(NOMINATIM_URL, {
      params: { format: 'json', lat, lon: lng, zoom: 16 },
      headers: { 'User-Agent': 'veekaycabs-admin-gps/1.0' },
      timeout: 5000,
    });
    const address = res.data?.display_name || null;
    geocodeCache.set(key, { address, expiresAt: Date.now() + GEOCODE_CACHE_TTL_MS });
    return address;
  } catch (error) {
    console.error('[GPS] Reverse geocode error:', error.response?.data || error.message);
    return cached?.address ?? null;
  }
};

module.exports = { getLiveLocations, isConfigured, getAddress };

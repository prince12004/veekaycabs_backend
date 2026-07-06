const axios = require('axios');

// ─── Millitrack (Uffizio) vehicle tracking ────────────────────────────────────
const MILLITRACK_URL = 'https://mvts1.millitrack.com/api/middleMan/getDeviceInfo';

const isConfigured = () =>
  !!process.env.UFFIZIO_API_KEY && process.env.UFFIZIO_API_KEY !== 'placeholder';

// Millitrack blocks IPs that poll faster than every 10s, so cache the raw
// response for slightly longer than that regardless of which IMEIs are asked
// for — the admin GPS page always requests the full fleet anyway.
const CACHE_TTL_MS = 12000;
let cache = { map: new Map(), fetchedAt: 0 };

// Returns a Map<deviceUniqueId, deviceObject> for the given IMEIs.
const getLiveLocations = async (imeis = []) => {
  if (!isConfigured() || imeis.length === 0) return new Map();

  if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.map;
  }

  const params = new URLSearchParams({ accessToken: process.env.UFFIZIO_API_KEY });
  imeis.forEach((imei) => params.append('imei', imei));

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

module.exports = { getLiveLocations, isConfigured };

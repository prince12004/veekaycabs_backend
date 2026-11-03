/**
 * Replaces the outdated ₹89 starting price with ₹92 in admin-managed website
 * content (SEO pages, blogs, offers, sliders, testimonials, settings). Never
 * touches bookings, payments or car prices.
 *
 * Usage:  node src/scripts/fixOutdatedStartingPrice.js            (preview only)
 *         node src/scripts/fixOutdatedStartingPrice.js --apply    (writes)
 */
require('dotenv').config();
const mongoose = require('mongoose');

const COLLECTIONS = ['carseopages', 'temposeopages', 'blogs', 'offers', 'sliders', 'testimonials', 'settings', 'policypages', 'cities'];
const OLD_PRICE = /(₹|&#8377;|&#x20B9;|\bRs\.?|\bINR)(\s*)89(?![\d,.]*\d)/gi;

const changedFields = (value, path = '', out = {}) => {
  if (typeof value === 'string') {
    const next = value.replace(OLD_PRICE, '$1$292');
    if (next !== value) out[path] = next;
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => changedFields(v, path ? `${path}.${i}` : String(i), out));
  } else if (value && typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId) && !(value instanceof Date)) {
    Object.entries(value).forEach(([k, v]) => changedFields(v, path ? `${path}.${k}` : k, out));
  }
  return out;
};

(async () => {
  const apply = process.argv.includes('--apply');
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  let total = 0;

  for (const name of COLLECTIONS) {
    for (const doc of await db.collection(name).find({}).toArray()) {
      const { _id, ...fields } = doc;
      const changes = changedFields(fields);
      for (const [field, next] of Object.entries(changes)) {
        const before = field.split('.').reduce((v, k) => v[k], fields);
        const at = before.search(OLD_PRICE);
        OLD_PRICE.lastIndex = 0;
        console.log(`${name} ${_id} ${field}: …${before.slice(Math.max(0, at - 40), at + 40)}…`);
        total++;
      }
      if (apply && Object.keys(changes).length) await db.collection(name).updateOne({ _id }, { $set: changes });
    }
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'} ${total} field(s).`);
  if (!apply) console.log('Preview only — re-run with --apply to write.');
  await mongoose.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Date-only values from admin date filters mean whole days in India, whatever
// timezone the server runs in. Anything else parses as before.
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const startOfDay = (value) => new Date(DATE_ONLY.test(value) ? `${value}T00:00:00+05:30` : value);
const endOfDay = (value) => new Date(DATE_ONLY.test(value) ? `${value}T23:59:59.999+05:30` : value);

module.exports = { startOfDay, endOfDay };

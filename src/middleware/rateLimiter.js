const rateLimit = require('express-rate-limit');

// OTP: strict — prevent SMS abuse
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests, please try again in 10 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,   // increased from 200 — supports high concurrent real users
  message: { success: false, message: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health', // never limit health checks
});

// Auth routes: brute-force protection on login/verify
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,   // slightly relaxed from 20 — users retry OTP
  message: { success: false, message: 'Too many authentication attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin routes: tighter since these aren't public-facing
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success: false, message: 'Too many admin requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { otpLimiter, apiLimiter, authLimiter, adminLimiter };

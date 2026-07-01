const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const passport = require('passport');
require('dotenv').config();

const { errorHandler, notFound } = require('./middleware/errorHandler');
const { apiLimiter, adminLimiter } = require('./middleware/rateLimiter');

// Public routes
const authRoutes = require('./routes/auth');
const carsRoutes = require('./routes/cars');
const bookingsRoutes = require('./routes/bookings');
const paymentsRoutes = require('./routes/payments');
const documentsRoutes = require('./routes/documents');
const usersRoutes = require('./routes/users');
const couponsRoutes = require('./routes/coupons');
const blogsRoutes = require('./routes/blogs');
const contactRoutes = require('./routes/contact');
const citiesRoutes = require('./routes/cities');

// Admin routes
const adminDashboardRoutes = require('./routes/admin/dashboard');
const adminCarsRoutes = require('./routes/admin/cars');
const adminBookingsRoutes = require('./routes/admin/bookings');
const adminUsersRoutes = require('./routes/admin/users');
const adminDocumentsRoutes = require('./routes/admin/documents');
const adminReportsRoutes = require('./routes/admin/reports');
const adminCouponsRoutes = require('./routes/admin/coupons');
const adminBlogsRoutes = require('./routes/admin/blogs');
const adminCitiesRoutes = require('./routes/admin/cities');
const adminContactsRoutes = require('./routes/admin/contacts');
const adminAdminsRoutes = require('./routes/admin/admins');
const adminTempoRoutes = require('./routes/admin/tempo');
const adminTempoBookingsRoutes = require('./routes/admin/tempoBookings');
const adminTempoSeoRoutes = require('./routes/admin/tempoSeo');
const adminSettingsRoutes = require('./routes/admin/settings');
const adminSliderRoutes = require('./routes/admin/slider');
const adminTestimonialsRoutes = require('./routes/admin/testimonials');
const adminOffersRoutes = require('./routes/admin/offers');
const adminPolicyRoutes = require('./routes/admin/policy');
const adminWhatsappRoutes = require('./routes/admin/whatsapp');
const adminVehicleVerificationRoutes = require('./routes/admin/vehicleVerification');
const tempoRoutes = require('./routes/tempo');
const favoritesRoutes = require('./routes/favorites');
const publicRoutes = require('./routes/public');

const app = express();

// Security, compression & logging
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression()); // gzip all responses — reduces bandwidth ~70%
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(passport.initialize());

// Razorpay webhook needs raw body — register before express.json()
app.post(
  '/api/webhooks/razorpay',
  express.raw({ type: 'application/json' }),
  require('./controllers/paymentsController').razorpayWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads (disk fallback)
app.use('/uploads', express.static('uploads'));

// Rate limiting on all /api routes
app.use('/api', apiLimiter);

// Public API routes
app.use('/api/auth', authRoutes);
app.use('/api/cars', carsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/blogs', blogsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/tempo', tempoRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/public', publicRoutes);

// Admin routes (separate tighter rate limit from public API)
app.use('/api/admin', adminLimiter);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/cars', adminCarsRoutes);
app.use('/api/admin/bookings', adminBookingsRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/admin/documents', adminDocumentsRoutes);
app.use('/api/admin/reports', adminReportsRoutes);
app.use('/api/admin/coupons', adminCouponsRoutes);
app.use('/api/admin/blogs', adminBlogsRoutes);
app.use('/api/admin/cities', adminCitiesRoutes);
app.use('/api/admin/contact-requests', adminContactsRoutes);
app.use('/api/admin/admins', adminAdminsRoutes);
app.use('/api/admin/tempo', adminTempoRoutes);
app.use('/api/admin/tempo-bookings', adminTempoBookingsRoutes);
app.use('/api/admin/tempo-seo', adminTempoSeoRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/slider', adminSliderRoutes);
app.use('/api/admin/testimonials', adminTestimonialsRoutes);
app.use('/api/admin/offers', adminOffersRoutes);
app.use('/api/admin/policy', adminPolicyRoutes);
app.use('/api/admin/whatsapp', adminWhatsappRoutes);
app.use('/api/admin/vehicle-verification', adminVehicleVerificationRoutes);

// Health check
app.get('/health', (req, res) =>
  res.json({ status: 'OK', timestamp: new Date().toISOString(), env: process.env.NODE_ENV })
);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

const express = require('express');
const passport = require('passport');
const router = express.Router();
const { sendOtp, verifyOtp, adminLogin, refreshToken, logout, googleCallback } = require('../controllers/authController');
const { otpLimiter, authLimiter } = require('../middleware/rateLimiter');

// Configure Google OAuth strategy lazily
const configurePassport = () => {
  const passportGoogleOAuth = require('passport-google-oauth20').Strategy;
  const User = require('../models/User');

  passport.use(
    new passportGoogleOAuth(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          let user = await User.findOne({ googleId: profile.id });

          if (!user && email) {
            user = await User.findOne({ email });
          }

          if (!user) {
            user = await User.create({
              googleId: profile.id,
              name: profile.displayName,
              email,
              profilePic: profile.photos?.[0]?.value,
              mobile: `google_${profile.id}`, // placeholder; user should add mobile later
              isVerified: true,
            });
          } else {
            if (!user.googleId) user.googleId = profile.id;
            user.lastLogin = new Date();
            await user.save();
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const User = require('../models/User');
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};

// Only configure if credentials exist
if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_ID !== 'placeholder.apps.googleusercontent.com'
) {
  configurePassport();
}

router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', authLimiter, verifyOtp);
router.post('/admin-login', authLimiter, adminLogin);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/google/error', session: false }),
  googleCallback
);

module.exports = router;

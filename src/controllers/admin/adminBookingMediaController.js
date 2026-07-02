const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const Anthropic = require('@anthropic-ai/sdk');
const Booking = require('../../models/Booking');
const BookingMedia = require('../../models/BookingMedia');
const UserDocument = require('../../models/UserDocument');
const User = require('../../models/User');
const { getFileUrl } = require('../../middleware/upload');
const { sendCarDocsToCustomer } = require('../../services/whatsapp');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DAMAGE_LABELS = [
  'dent', 'scratch', 'damage', 'crack', 'broken', 'rust', 'collision',
  'deformation', 'chip', 'gouge', 'abrasion', 'wrinkle', 'tear',
];

// ── Roboflow car damage detection (returns bounding boxes) ───────────────────
const analyzeWithRoboflow = async (imageUrl) => {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const model = process.env.ROBOFLOW_MODEL || 'car-damage-detection/1';
  if (!apiKey || apiKey === 'placeholder') {
    return { predictions: [], damage: false, score: 0, damageLabels: [], imageWidth: 640, imageHeight: 480 };
  }
  try {
    const resp = await axios({
      method: 'POST',
      url: `https://detect.roboflow.com/${model}?api_key=${apiKey}`,
      data: imageUrl,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 20000,
    });
    const { predictions = [], image = {} } = resp.data;
    const hits = predictions.filter((p) => p.confidence > 0.25);
    const labels = [...new Set(hits.map((p) => p.class))];
    const maxScore = hits.length > 0 ? Math.max(...hits.map((p) => Math.round(p.confidence * 100))) : 0;
    return {
      predictions: hits,
      damage: hits.length > 0,
      score: maxScore,
      damageLabels: labels,
      imageWidth: image.width || 640,
      imageHeight: image.height || 480,
    };
  } catch (err) {
    console.error('Roboflow error:', err.response?.data || err.message);
    return { predictions: [], damage: false, score: 0, damageLabels: [], imageWidth: 640, imageHeight: 480 };
  }
};

// ── Google Vision fallback ────────────────────────────────────────────────────
const analyzeWithVision = async (imageUrl) => {
  const visionKey = process.env.GOOGLE_VISION_API_KEY;
  if (!visionKey || visionKey === 'placeholder') {
    return { predictions: [], damage: false, score: 0, damageLabels: [], imageWidth: 640, imageHeight: 480 };
  }
  try {
    const resp = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      { requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: 'LABEL_DETECTION', maxResults: 20 }] }] },
      { timeout: 15000 }
    );
    const annotations = resp.data.responses?.[0]?.labelAnnotations || [];
    const labels = annotations.map((l) => ({ label: l.description, score: Math.round(l.score * 100) }));
    const damageHits = labels.filter((l) => DAMAGE_LABELS.some((d) => l.label.toLowerCase().includes(d)));
    const maxScore = damageHits.length > 0 ? Math.max(...damageHits.map((l) => l.score)) : 0;
    return {
      predictions: [],
      damage: maxScore >= 60,
      score: maxScore,
      damageLabels: damageHits.map((l) => l.label),
      imageWidth: 640,
      imageHeight: 480,
    };
  } catch (err) {
    console.error('Vision API error:', err.message);
    return { predictions: [], damage: false, score: 0, damageLabels: [], imageWidth: 640, imageHeight: 480 };
  }
};

const isCloudinaryConfigured = () =>
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'placeholder';

// ─── POST /api/admin/bookings/:id/media ──────────────────────────────────────
// Upload pickup or return video/photos. Files uploaded via multer middleware.
// Body fields: type ('pickup' | 'return'), notes
const uploadBookingMedia = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const { type = 'pickup', notes = '' } = req.body;
    const mediaType = type === 'return' ? 'return_photos' : 'pickup_photos';

    const files = req.files || (req.file ? [req.file] : []);
    if (!files.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }

    const urls = files.map((f) => getFileUrl(f)).filter(Boolean);

    const media = await BookingMedia.create({
      bookingId: booking._id,
      type: mediaType,
      urls,
      notes,
      uploadedBy: 'admin',
    });

    return res.json({ success: true, data: media });
  } catch (error) {
    console.error('uploadBookingMedia error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload media' });
  }
};

// ─── GET /api/admin/bookings/:id/media ───────────────────────────────────────
const getBookingMedia = async (req, res) => {
  try {
    const [booking, media] = await Promise.all([
      Booking.findById(req.params.id, '_id'),
      BookingMedia.find({ bookingId: req.params.id }).sort({ uploadedAt: 1 }),
    ]);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    return res.json({ success: true, data: media });
  } catch (error) {
    console.error('getBookingMedia error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch media' });
  }
};

// ─── POST /api/admin/bookings/:id/analyze-damage ─────────────────────────────
// Extracts images from pickup + return media, runs Roboflow dent detection
// (falls back to Google Vision), returns predictions with bounding boxes.
const analyzeVehicleDamage = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const allMedia = await BookingMedia.find({ bookingId: booking._id });
    const pickupMedia = allMedia.filter((m) => m.type === 'pickup_photos');
    const returnMedia = allMedia.filter((m) => m.type === 'return_photos');

    if (!pickupMedia.length) return res.status(400).json({ success: false, message: 'No pickup media found' });
    if (!returnMedia.length) return res.status(400).json({ success: false, message: 'No return media found' });

    // Convert video URLs to Cloudinary image thumbnails; pass images through as-is
    // Detects videos by extension OR by /video/upload/ path (Cloudinary stores without extension)
    const toAnalyzableUrl = (url) => {
      if (!url) return null;
      const isVideo = url.match(/\.(mp4|mov|avi|webm)/i) || url.includes('/video/upload/');
      if (isVideo) {
        if (!isCloudinaryConfigured()) return null;
        try {
          const parts = url.split('/upload/');
          if (parts.length !== 2) return null;
          const base = parts[1].replace(/\.(mp4|mov|avi|webm)$/i, '');
          // f_jpg forces JPEG output; so_3 captures frame at 3 seconds
          return `${parts[0]}/upload/so_3,w_640,h_480,c_fill,f_jpg/${base}.jpg`;
        } catch { return null; }
      }
      return url;
    };

    const pickupUrls = pickupMedia.flatMap((m) => m.urls).map(toAnalyzableUrl).filter(Boolean);
    const returnUrls = returnMedia.flatMap((m) => m.urls).map(toAnalyzableUrl).filter(Boolean);

    const useRoboflow = !!(process.env.ROBOFLOW_API_KEY && process.env.ROBOFLOW_API_KEY !== 'placeholder');
    const analyzeFn = useRoboflow ? analyzeWithRoboflow : analyzeWithVision;

    // Analyze up to 3 images per set
    const analyzeSet = async (urls) => {
      const results = await Promise.all(urls.slice(0, 3).map(analyzeFn));
      const allPredictions = results.flatMap((r) => r.predictions || []);
      const allLabels = [...new Set(results.flatMap((r) => r.damageLabels || []))];
      const maxScore = Math.max(...results.map((r) => r.score), 0);
      const damage = results.some((r) => r.damage);
      const { imageWidth, imageHeight } = results[0] || { imageWidth: 640, imageHeight: 480 };
      return { predictions: allPredictions, damageLabels: allLabels, score: maxScore, damage, imageWidth, imageHeight };
    };

    const [pickupAnalysis, returnAnalysis] = await Promise.all([
      analyzeSet(pickupUrls),
      analyzeSet(returnUrls),
    ]);

    const newDamageDetected = returnAnalysis.damage && returnAnalysis.score > pickupAnalysis.score + 10;

    return res.json({
      success: true,
      data: {
        pickup: { ...pickupAnalysis, thumbnails: pickupUrls },
        return: { ...returnAnalysis, thumbnails: returnUrls },
        newDamageDetected,
        apiUsed: useRoboflow ? 'roboflow' : 'vision',
        verdict: newDamageDetected ? 'Naya dent/scratch detect hua — photos dhyan se compare karo' : 'Koi naya damage nahi mila',
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('analyzeVehicleDamage error:', error);
    return res.status(500).json({ success: false, message: 'Damage analysis failed' });
  }
};

// ── Claude-powered dent detection ────────────────────────────────────────────
const isAnthropicConfigured = () =>
  process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder';

const DENT_DETECTION_MODEL = 'claude-sonnet-4-6';
const DENT_FRAME_OFFSETS = [1, 3, 5, 7, 9]; // seconds — up to 5 frames per video

// Canonical car-part checklist the model must report a status for, on both
// pickup and return — forces full coverage instead of free-association,
// which is what let real damage slip through unreported before.
const CAR_PART_CHECKLIST = [
  'front_bumper', 'rear_bumper', 'hood', 'roof',
  'front_left_door', 'front_right_door', 'rear_left_door', 'rear_right_door',
  'front_left_fender', 'front_right_fender',
  'rear_left_quarter_panel', 'rear_right_quarter_panel',
  'trunk_tailgate',
  'front_left_wheel_rim', 'front_right_wheel_rim', 'rear_left_wheel_rim', 'rear_right_wheel_rim',
  'left_mirror', 'right_mirror', 'windshield', 'rear_glass', 'headlights', 'taillights',
];

const PART_STATUS_RANK = { not_visible: 0, ok: 1, minor_mark: 2, damaged: 3 };

const humanizePart = (part) =>
  part.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// New damage = return status is worse than pickup status AND is at least a
// minor mark. If pickup wasn't visible at all, we still flag a damaged/minor
// return as new (lowConfidence: true) rather than silently staying quiet —
// biasing toward catching things instead of the old "default to not report".
const computeNewDamage = (pickupStatus, returnStatus) => {
  const pickupRank = PART_STATUS_RANK[pickupStatus] ?? 0;
  const returnRank = PART_STATUS_RANK[returnStatus] ?? 0;
  const returnIsMarked = returnStatus === 'minor_mark' || returnStatus === 'damaged';
  if (!returnIsMarked) return { newDamage: false, lowConfidence: false };
  if (pickupStatus === 'not_visible') return { newDamage: true, lowConfidence: true };
  return { newDamage: returnRank > pickupRank, lowConfidence: false };
};

// Turns a stored Cloudinary URL into 1-5 still-image URLs for the AI to inspect.
// Videos get multiple seek-offset frames (so_Ns) via Cloudinary transforms — no
// local ffmpeg needed since the source is already hosted on Cloudinary.
const buildFrameUrls = (url) => {
  if (!url) return [];
  const isVideo = url.match(/\.(mp4|mov|avi|webm)/i) || url.includes('/video/upload/');
  if (!isVideo) return [url];
  if (!isCloudinaryConfigured()) return [];
  const parts = url.split('/upload/');
  if (parts.length !== 2) return [];
  const base = parts[1].replace(/\.(mp4|mov|avi|webm)$/i, '');
  return DENT_FRAME_OFFSETS.map(
    (s) => `${parts[0]}/upload/so_${s},w_768,h_768,c_fill,f_jpg,q_auto/${base}.jpg`
  );
};

const DENT_DETECTION_SYSTEM_PROMPT = `You are an expert vehicle damage inspector for a self-drive car rental company. You will be shown PICKUP photos/frames (the car's condition BEFORE the rental) followed by RETURN photos/frames (the car's condition AFTER the rental). Multiple images may just be different frames of the same handover video, shot from slightly different angles — they are NOT separate inspections.

You must inspect the car PART BY PART using this exact canonical checklist — every part below must appear exactly once in your output, for BOTH pickup and return, even if a part is not clearly visible in any photo (in that case mark it "not_visible"):

${CAR_PART_CHECKLIST.join(', ')}

For EACH part above, independently assess:
1. PICKUP status — look across ALL pickup images for that part. Status is one of: "ok" (no visible damage), "minor_mark" (small scuff/scratch/chip that is cosmetic and easy to miss), "damaged" (dent/crack/break/significant scratch), or "not_visible" (no pickup photo shows this part clearly enough to judge).
2. RETURN status — same four-way classification, looking across ALL return images for that part.
3. A short matchNote explaining your reasoning ONLY when pickup and return differ in severity for that part — e.g. "small scuff at pickup, same location/size at return — looks unchanged" or "no mark at pickup, clear dent visible at return near fuel cap" or "angle differs from pickup photo, cannot confirm if this is new". Leave matchNote as an empty string when pickup and return clearly match (both ok, or both damaged identically).

Be thorough and literal — do not pre-filter or suppress what you see. Report the RETURN status honestly even if you are not sure yet whether it is new; the new-vs-pre-existing determination is made separately, outside your response. Your job here is accurate per-part observation, not the final verdict. Pay close attention to minor dents, small scratches, paint chips, hairline cracks, scuffed bumpers, and wheel/rim damage — these are the most commonly missed.

After completing the part-by-part checklist, also write:
- A "summary" sentence in plain language for an admin user (Hinglish is fine), focused on anything that looks newly damaged at return.
- A "confidenceNote" describing any limitations (e.g. poor angle, blurry frame, part not photographed at all) that affect your confidence in the checklist above.

Respond with ONLY a valid JSON object — no markdown formatting, no commentary outside the JSON — in this exact shape. The "partsChecked" array MUST contain exactly one entry per part listed above, using the exact part id strings given (snake_case, e.g. "front_left_door"), in any order:
{
  "partsChecked": [
    { "part": string, "pickupStatus": "ok" | "minor_mark" | "damaged" | "not_visible", "returnStatus": "ok" | "minor_mark" | "damaged" | "not_visible", "matchNote": string }
  ],
  "summary": string,
  "confidenceNote": string
}`;

const parseDentJson = (text) => {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

// ─── POST /api/admin/bookings/:id/dent-detection ─────────────────────────────
// Compares pickup vs return media with Claude vision and caches the verdict on
// the booking. Pass { force: true } in the body to re-run instead of using cache.
const runDentDetection = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const force = req.body?.force === true || req.query.force === 'true';
    if (!force && booking.dentDetectionResult?.analyzedAt) {
      return res.json({ success: true, data: booking.dentDetectionResult, cached: true });
    }

    if (!isAnthropicConfigured()) {
      return res.status(400).json({ success: false, message: 'AI dent detection not configured. Add ANTHROPIC_API_KEY in server .env.' });
    }

    const allMedia = await BookingMedia.find({ bookingId: booking._id });
    const pickupMedia = allMedia.filter((m) => m.type === 'pickup_photos');
    const returnMedia = allMedia.filter((m) => m.type === 'return_photos');

    if (!pickupMedia.length) return res.status(400).json({ success: false, message: 'No pickup photos/video uploaded yet.' });
    if (!returnMedia.length) return res.status(400).json({ success: false, message: 'No return photos/video uploaded yet.' });

    const pickupUrls = pickupMedia.flatMap((m) => m.urls).flatMap(buildFrameUrls).filter(Boolean).slice(0, 6);
    const returnUrls = returnMedia.flatMap((m) => m.urls).flatMap(buildFrameUrls).filter(Boolean).slice(0, 6);

    if (!pickupUrls.length || !returnUrls.length) {
      return res.status(400).json({ success: false, message: 'Could not process pickup/return media for analysis. Make sure Cloudinary is configured.' });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: DENT_DETECTION_MODEL,
      max_tokens: 3000,
      system: DENT_DETECTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'PICKUP photos — condition of the car BEFORE the rental:' },
          ...pickupUrls.map((url) => ({ type: 'image', source: { type: 'url', url } })),
          { type: 'text', text: 'RETURN photos — condition of the car AFTER the rental:' },
          ...returnUrls.map((url) => ({ type: 'image', source: { type: 'url', url } })),
          { type: 'text', text: 'Go through the part checklist for both pickup and return and respond with the JSON object only.' },
        ],
      }],
    });

    const rawText = message.content?.find((b) => b.type === 'text')?.text || '';
    const parsed = parseDentJson(rawText);
    if (!parsed) {
      return res.status(502).json({ success: false, message: 'AI response could not be parsed. Try re-running.' });
    }

    // Validate/repair the model's partsChecked array against the canonical
    // checklist — guarantees a complete, predictable array regardless of
    // model compliance, and keeps the new-vs-pre-existing call out of the
    // model's hands (see computeNewDamage above).
    const reportedByPart = new Map(
      (Array.isArray(parsed.partsChecked) ? parsed.partsChecked : []).map((p) => [p.part, p])
    );
    const unknownParts = [...reportedByPart.keys()].filter((p) => !CAR_PART_CHECKLIST.includes(p));
    if (reportedByPart.size !== CAR_PART_CHECKLIST.length || unknownParts.length) {
      console.warn(
        `runDentDetection: model returned ${reportedByPart.size}/${CAR_PART_CHECKLIST.length} parts` +
        (unknownParts.length ? `, unknown ids: ${unknownParts.join(', ')}` : '')
      );
    }

    const partsChecked = CAR_PART_CHECKLIST.map((part) => {
      const reported = reportedByPart.get(part);
      const pickupStatus = reported?.pickupStatus in PART_STATUS_RANK ? reported.pickupStatus : 'not_visible';
      const returnStatus = reported?.returnStatus in PART_STATUS_RANK ? reported.returnStatus : 'not_visible';
      const note = reported ? (reported.matchNote || '') : 'model did not report this part';
      const { newDamage, lowConfidence } = computeNewDamage(pickupStatus, returnStatus);
      return { part, pickupStatus, returnStatus, newDamage, lowConfidence, note };
    });

    const flaggedParts = partsChecked.filter((p) => p.newDamage);

    const result = {
      newDamageFound: flaggedParts.length > 0,
      damageCount: flaggedParts.length,
      damages: flaggedParts.map((p) => ({
        location: humanizePart(p.part),
        type: p.returnStatus === 'damaged' ? 'damage' : 'minor mark',
        severity: p.returnStatus === 'damaged' ? 'moderate' : 'minor',
        description: p.note,
      })),
      partsChecked,
      summary: parsed.summary || '',
      confidenceNote: parsed.confidenceNote || '',
      analyzedAt: new Date(),
      model: DENT_DETECTION_MODEL,
    };

    booking.dentDetectionResult = result;
    await booking.save();

    return res.json({ success: true, data: result, cached: false });
  } catch (error) {
    console.error('runDentDetection error:', error.response?.data || error.message);
    return res.status(500).json({ success: false, message: 'AI dent detection failed. ' + (error.message || '') });
  }
};

// ─── GET /api/admin/bookings/:id/user-docs ───────────────────────────────────
// Fetch the customer's uploaded KYC documents for the booking
const getBookingUserDocs = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('userId', 'name mobile email kycStatus');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const userId = booking.userId?._id || booking.userId;
    const docs = await UserDocument.findOne({ userId });

    return res.json({
      success: true,
      data: {
        user: booking.userId,
        documents: docs || null,
      },
    });
  } catch (error) {
    console.error('getBookingUserDocs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user documents' });
  }
};

// ─── POST /api/admin/bookings/:id/send-car-docs ──────────────────────────────
// Admin sends booked car documents to customer via WhatsApp template
const sendCarDocsWhatsApp = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('userId', 'name mobile')
      .populate('carId');

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Admin can pass overrideMobile for Google-login users who have no stored mobile
    const { overrideMobile } = req.body;
    let mobile = booking.userId?.mobile;
    if (!mobile || mobile.startsWith('google_')) {
      if (!overrideMobile || !/^\d{10}$/.test(overrideMobile)) {
        return res.status(400).json({ success: false, message: 'Customer has no valid mobile. Provide a 10-digit overrideMobile.' });
      }
      mobile = overrideMobile;

      // Persist the override onto this customer's account so future sends
      // (invoices, confirmations, etc.) don't need it re-typed each time.
      // Skip silently if another account already owns this number.
      const existing = await User.findOne({ mobile: overrideMobile });
      if (!existing) {
        await User.findByIdAndUpdate(booking.userId._id, { mobile: overrideMobile }, { runValidators: true });
      }
    }

    const car = booking.carId;
    // Collect available document URLs to send as attachments
    const docSlots = [
      { key: 'rc',       label: 'RC Book' },
      { key: 'insurance', label: 'Insurance' },
      { key: 'puc',      label: 'PUC Certificate' },
      { key: 'fitness',  label: 'Fitness Certificate' },
      { key: 'roadTax',  label: 'Road Tax' },
    ];
    const availableDocs = docSlots
      .filter(d => car?.documents?.[d.key]?.url)
      .map(d => ({ url: car.documents[d.key].url, label: d.label }));

    console.log(`[sendCarDocs] booking=${booking.bookingId} car=${car?.name} availableDocs=${JSON.stringify(availableDocs)}`);

    if (availableDocs.length === 0) {
      return res.status(400).json({ success: false, message: 'No document files uploaded for this car. Please upload RC, Insurance, PUC files in Car Documents section first.' });
    }

    const result = await sendCarDocsToCustomer(
      mobile,
      booking.userId?.name || 'Customer',
      car,
      booking.bookingId,
      availableDocs
    );

    const failedDocs = result.errors || [];
    const msg = failedDocs.length > 0
      ? `WhatsApp notification sent. PDF attachment requires NeoDove API upgrade.`
      : `Car documents notification sent to customer via WhatsApp.`;

    return res.json({ success: true, message: msg, failedDocs, totalDocs: availableDocs.length });
  } catch (error) {
    console.error('sendCarDocsWhatsApp error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send car documents' });
  }
};

// ─── DELETE /api/admin/bookings/:id/media/:mediaId ───────────────────────────
// Removes one URL from a BookingMedia record. Deletes the record if no URLs remain.
const deleteBookingMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { url } = req.body; // specific URL to remove (optional — if omitted, delete whole record)

    const media = await BookingMedia.findById(mediaId);
    if (!media) return res.status(404).json({ success: false, message: 'Media not found' });

    if (url) {
      media.urls = media.urls.filter((u) => u !== url);
      if (media.urls.length === 0) {
        await media.deleteOne();
      } else {
        await media.save();
      }
    } else {
      await media.deleteOne();
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('deleteBookingMedia error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete media' });
  }
};

module.exports = {
  uploadBookingMedia,
  getBookingMedia,
  deleteBookingMedia,
  analyzeVehicleDamage,
  runDentDetection,
  getBookingUserDocs,
  sendCarDocsWhatsApp,
};

// ============================================================
// Donor Routes - Donor profile & search
// ============================================================
const express = require('express');
const { body, query } = require('express-validator');
const donorController = require('../controllers/donor.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// POST /api/donors/profile - Create donor profile
router.post('/profile', [
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Valid blood group is required'),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('age').isInt({ min: 18, max: 65 }).withMessage('Age must be between 18-65'),
  body('weight').isFloat({ min: 50 }).withMessage('Weight must be at least 50 kg'),
  validate,
], donorController.createProfile);

// GET /api/donors/profile - Get own donor profile
router.get('/profile', donorController.getProfile);

// PUT /api/donors/profile - Update donor profile
router.put('/profile', donorController.updateProfile);

// PUT /api/donors/toggle-availability
router.put('/toggle-availability', donorController.toggleAvailability);

// GET /api/donors/history - Get donation history
router.get('/history', donorController.getDonationHistory);

// POST /api/donors/history - Add donation record
router.post('/history', [
  body('date').notEmpty().withMessage('Date is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  validate,
], donorController.addDonationRecord);

// GET /api/donors/nearby - Search nearby donors
router.get('/nearby', [
  query('lat').isFloat().withMessage('Latitude is required'),
  query('lng').isFloat().withMessage('Longitude is required'),
  query('radius').optional().isFloat({ min: 1, max: 200 }),
  query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  validate,
], donorController.findNearby);

// GET /api/donors/compatible - Get all available donors compatible with a blood group (no geo restriction)
router.get('/compatible', [
  query('bloodGroup').optional().isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  validate,
], donorController.getCompatible);

// GET /api/donors/all - List all donors (admin)
router.get('/all', authorize('admin'), donorController.getAllDonors);

module.exports = router;

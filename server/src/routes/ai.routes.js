// ============================================================
// AI Routes - Smart matching, predictions, classification
// ============================================================
const express = require('express');
const { body, query } = require('express-validator');
const aiController = require('../controllers/ai.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// POST /api/ai/match-donors - Smart donor matching with AI ranking
router.post('/match-donors', [
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  body('lat').isFloat(),
  body('lng').isFloat(),
  body('urgency').optional().isIn(['critical', 'moderate', 'normal']),
  validate,
], aiController.matchDonors);

// POST /api/ai/classify-urgency - Classify request urgency
router.post('/classify-urgency', [
  body('description').trim().notEmpty(),
  body('units').optional().isInt({ min: 1 }),
  validate,
], aiController.classifyUrgency);

// GET /api/ai/demand-prediction - Predict blood demand
router.get('/demand-prediction', aiController.demandPrediction);

// POST /api/ai/check-eligibility - Check donor eligibility
router.post('/check-eligibility', [
  body('age').isInt({ min: 0 }),
  body('weight').isFloat({ min: 0 }),
  body('lastDonationDate').optional(),
  body('healthScore').optional().isFloat({ min: 0, max: 100 }),
  validate,
], aiController.checkEligibility);

// POST /api/ai/detect-fraud - Detect fake requests
router.post('/detect-fraud', [
  body('description').trim().notEmpty(),
  body('units').isInt({ min: 1 }),
  body('hospital').trim().notEmpty(),
  validate,
], aiController.detectFraud);

// POST /api/ai/chatbot - AI FAQ Chatbot
router.post('/chatbot', [
  body('message').trim().notEmpty(),
  validate,
], aiController.chatbot);

module.exports = router;

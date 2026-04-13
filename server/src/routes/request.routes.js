// ============================================================
// Blood Request Routes
// ============================================================
const express = require('express');
const { body, query } = require('express-validator');
const requestController = require('../controllers/request.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

router.use(authenticate);

// POST /api/requests - Create new blood request
router.post('/', [
  body('bloodGroup').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .withMessage('Valid blood group required'),
  body('units').isInt({ min: 1, max: 10 }).withMessage('Units must be 1-10'),
  body('lat').isFloat({ min: -90, max: 90 }),
  body('lng').isFloat({ min: -180, max: 180 }),
  body('address').trim().notEmpty(),
  body('hospital').trim().notEmpty(),
  body('description').optional().trim().isLength({ max: 1000 }),
  validate,
], requestController.createRequest);

// GET /api/requests - Get requests (filtered)
router.get('/', requestController.getRequests);

// GET /api/requests/my - Get my requests
router.get('/my', requestController.getMyRequests);

// GET /api/requests/:id - Get single request
router.get('/:id', requestController.getRequestById);

// PUT /api/requests/:id - Update request
router.put('/:id', requestController.updateRequest);

// PUT /api/requests/:id/status - Update request status
router.put('/:id/status', [
  body('status').isIn(['open', 'matched', 'fulfilled', 'cancelled']),
  validate,
], requestController.updateStatus);

// PUT /api/requests/:id/match - Match a donor to request
router.put('/:id/match', [
  body('donorId').notEmpty().withMessage('Donor ID is required'),
  validate,
], requestController.matchDonor);

// DELETE /api/requests/:id - Cancel request
router.delete('/:id', requestController.deleteRequest);

module.exports = router;

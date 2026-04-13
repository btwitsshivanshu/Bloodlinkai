// ============================================================
// Auth Routes - Registration, Login, Google OAuth
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['donor', 'receiver']).withMessage('Role must be donor or receiver'),
  validate,
], authController.register);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
], authController.login);

// POST /api/auth/google
router.post('/google', [
  body('credential').notEmpty().withMessage('Google credential is required'),
  validate,
], authController.googleLogin);

// GET /api/auth/me - Get current user
router.get('/me', authenticate, authController.getMe);

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authenticate, authController.refreshToken);

module.exports = router;

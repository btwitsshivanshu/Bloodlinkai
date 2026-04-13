// ============================================================
// Admin Routes - Dashboard & Management
// ============================================================
const express = require('express');
const adminController = require('../controllers/admin.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', adminController.getStats);

// GET /api/admin/users - List all users
router.get('/users', adminController.getUsers);

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', adminController.updateUserRole);

// PUT /api/admin/users/:id/status - Activate/Deactivate user
router.put('/users/:id/status', adminController.toggleUserStatus);

// GET /api/admin/requests - Get all requests with filters
router.get('/requests', adminController.getAllRequests);

// GET /api/admin/analytics - Analytics data for charts
router.get('/analytics', adminController.getAnalytics);

module.exports = router;

// ============================================================
// Admin Controller - Dashboard & user management
// ============================================================
const User = require('../models/User');
const DonorProfile = require('../models/DonorProfile');
const BloodRequest = require('../models/BloodRequest');

/**
 * GET /api/admin/stats - Dashboard statistics
 */
exports.getStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalDonors,
      activeDonors,
      totalReceivers,
      totalRequests,
      activeRequests,
      fulfilledRequests,
      cancelledRequests,
    ] = await Promise.all([
      User.countDocuments(),
      DonorProfile.countDocuments(),
      DonorProfile.countDocuments({ available: true }),
      User.countDocuments({ role: 'receiver' }),
      BloodRequest.countDocuments(),
      BloodRequest.countDocuments({ status: 'open' }),
      BloodRequest.countDocuments({ status: 'fulfilled' }),
      BloodRequest.countDocuments({ status: 'cancelled' }),
    ]);

    // Calculate total donations
    const donorAgg = await DonorProfile.aggregate([
      { $group: { _id: null, totalDonations: { $sum: '$totalDonations' } } },
    ]);
    const totalDonations = donorAgg[0]?.totalDonations || 0;

    res.json({
      stats: {
        totalUsers,
        totalDonors,
        activeDonors,
        totalReceivers,
        totalRequests,
        activeRequests,
        fulfilledRequests,
        cancelledRequests,
        totalDonations,
        matchRate: totalRequests > 0
          ? Math.round((fulfilledRequests / totalRequests) * 100)
          : 0,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

/**
 * GET /api/admin/users - List all users
 */
exports.getUsers = async (req, res) => {
  try {
    const { role, page = 1, limit = 20, search } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(filter).skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 }),
      User.countDocuments(filter),
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

/**
 * PUT /api/admin/users/:id/role - Update user role
 */
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['donor', 'receiver', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Role updated', user });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
};

/**
 * PUT /api/admin/users/:id/status - Toggle active status
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `User ${user.isActive ? 'activated' : 'deactivated'}`,
      user,
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: 'Failed to toggle status' });
  }
};

/**
 * GET /api/admin/requests - Get all requests
 */
exports.getAllRequests = async (req, res) => {
  try {
    const { status, bloodGroup, urgency, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (urgency) filter.urgency = urgency;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      BloodRequest.find(filter)
        .populate('receiverId', 'name email')
        .populate('matchedDonorId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BloodRequest.countDocuments(filter),
    ]);

    res.json({
      requests,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Get all requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
};

/**
 * GET /api/admin/analytics - Charts data
 */
exports.getAnalytics = async (req, res) => {
  try {
    // Requests by blood group
    const byBloodGroup = await BloodRequest.aggregate([
      { $group: { _id: '$bloodGroup', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Requests by status
    const byStatus = await BloodRequest.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Requests by urgency
    const byUrgency = await BloodRequest.aggregate([
      { $group: { _id: '$urgency', count: { $sum: 1 } } },
    ]);

    // Monthly trends (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrend = await BloodRequest.aggregate([
      { $match: { createdAt: { $gte: twelveMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Donors by blood group
    const donorsByGroup = await DonorProfile.aggregate([
      { $group: { _id: '$bloodGroup', count: { $sum: 1 }, available: { $sum: { $cond: ['$available', 1, 0] } } } },
    ]);

    res.json({
      analytics: {
        byBloodGroup,
        byStatus,
        byUrgency,
        monthlyTrend,
        donorsByGroup,
      },
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};

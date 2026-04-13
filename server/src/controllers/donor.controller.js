// ============================================================
// Donor Controller - Profile, search, history
// ============================================================
const DonorProfile = require('../models/DonorProfile');
const User = require('../models/User');

/**
 * POST /api/donors/profile - Create donor profile
 */
exports.createProfile = async (req, res) => {
  try {
    const existing = await DonorProfile.findOne({ userId: req.userId });
    if (existing) {
      return res.status(400).json({ error: 'Donor profile already exists' });
    }

    const { bloodGroup, lat, lng, address, age, weight, available } = req.body;

    const profile = await DonorProfile.create({
      userId: req.userId,
      bloodGroup,
      location: {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON: [longitude, latitude]
      },
      address,
      age,
      weight,
      available: available !== undefined ? available : true,
    });

    res.status(201).json({ message: 'Donor profile created', profile });
  } catch (error) {
    console.error('Create donor profile error:', error);
    res.status(500).json({ error: 'Failed to create donor profile' });
  }
};

/**
 * GET /api/donors/profile - Get own profile
 */
exports.getProfile = async (req, res) => {
  try {
    const profile = await DonorProfile.findOne({ userId: req.userId })
      .populate('userId', 'name email avatar phone');

    if (!profile) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Get donor profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
};

/**
 * PUT /api/donors/profile - Update donor profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, bloodGroup, lat, lng, address, age, weight, available, healthScore } = req.body;
    const updates = {};

    if (bloodGroup) updates.bloodGroup = bloodGroup;
    if (address) updates.address = address;
    if (age) updates.age = age;
    if (weight) updates.weight = weight;
    if (available !== undefined) updates.available = available;
    if (healthScore) updates.healthScore = healthScore;
    if (lat && lng) {
      updates.location = { type: 'Point', coordinates: [lng, lat] };
    }

    // Update name on the User model if provided
    if (name) {
      await User.findByIdAndUpdate(req.userId, { $set: { name } });
    }

    const profile = await DonorProfile.findOneAndUpdate(
      { userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!profile) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json({ message: 'Profile updated', profile });
  } catch (error) {
    console.error('Update donor profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

/**
 * PUT /api/donors/toggle-availability
 */
exports.toggleAvailability = async (req, res) => {
  try {
    const profile = await DonorProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    profile.available = !profile.available;
    await profile.save();

    res.json({
      message: `Availability set to ${profile.available ? 'available' : 'unavailable'}`,
      available: profile.available,
    });
  } catch (error) {
    console.error('Toggle availability error:', error);
    res.status(500).json({ error: 'Failed to toggle availability' });
  }
};

/**
 * GET /api/donors/history - Get donation history
 */
exports.getDonationHistory = async (req, res) => {
  try {
    const profile = await DonorProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    res.json({
      totalDonations: profile.totalDonations,
      history: profile.donationHistory.sort((a, b) => new Date(b.date) - new Date(a.date)),
    });
  } catch (error) {
    console.error('Get donation history error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
};

/**
 * POST /api/donors/history - Add donation record
 */
exports.addDonationRecord = async (req, res) => {
  try {
    const { date, location, receiverName, bloodGroup, units, hospital } = req.body;

    const profile = await DonorProfile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(404).json({ error: 'Donor profile not found' });
    }

    profile.donationHistory.push({
      date: new Date(date),
      location,
      receiverName: receiverName || 'Anonymous',
      bloodGroup: bloodGroup || profile.bloodGroup,
      units: units || 1,
      hospital: hospital || '',
    });
    profile.totalDonations += 1;
    profile.lastDonationDate = new Date(date);
    await profile.save();

    res.status(201).json({ message: 'Donation record added', profile });
  } catch (error) {
    console.error('Add donation record error:', error);
    res.status(500).json({ error: 'Failed to add record' });
  }
};

/**
 * GET /api/donors/nearby - Find nearby donors using geospatial query
 */
exports.findNearby = async (req, res) => {
  try {
    const { lat, lng, radius, bloodGroup } = req.query;
    const radiusKm = parseFloat(radius) || 50;
    const radiusMeters = radiusKm * 1000;

    const query = {
      available: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: radiusMeters,
        },
      },
    };

    if (bloodGroup) {
      query.bloodGroup = bloodGroup;
    }

    const donors = await DonorProfile.find(query)
      .populate('userId', 'name email avatar phone')
      .limit(50);

    // Calculate distance for each donor
    const results = donors.map(donor => {
      const distance = haversineDistance(
        parseFloat(lat), parseFloat(lng),
        donor.location.coordinates[1], donor.location.coordinates[0]
      );
      return {
        ...donor.toObject(),
        distance: Math.round(distance * 10) / 10,
        userName: donor.userId?.name || 'Unknown',
        userEmail: donor.userId?.email || '',
        userAvatar: donor.userId?.avatar || '',
      };
    });

    // Sort by distance
    results.sort((a, b) => a.distance - b.distance);

    res.json({ donors: results, count: results.length });
  } catch (error) {
    console.error('Find nearby error:', error);
    res.status(500).json({ error: 'Failed to find nearby donors' });
  }
};

/**
 * GET /api/donors/compatible?bloodGroup=AB+ - Get all available donors compatible with a blood group
 * Used by AI matching — no geo restriction so results are always returned
 */
exports.getCompatible = async (req, res) => {
  try {
    const { bloodGroup } = req.query;

    // Blood groups that can donate to the requested group
    const COMPATIBILITY = {
      'O-':  ['O-'],
      'O+':  ['O-', 'O+'],
      'A-':  ['O-', 'A-'],
      'A+':  ['O-', 'O+', 'A-', 'A+'],
      'B-':  ['O-', 'B-'],
      'B+':  ['O-', 'O+', 'B-', 'B+'],
      'AB-': ['O-', 'A-', 'B-', 'AB-'],
      'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    };

    const compatibleGroups = bloodGroup ? (COMPATIBILITY[bloodGroup] || []) : [];
    const query = { available: true, userId: { $ne: req.userId } };
    if (compatibleGroups.length > 0) query.bloodGroup = { $in: compatibleGroups };

    // Also filter out donors still in the 56-day cooldown period
    const cooldownDate = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000);
    query.$or = [
      { totalDonations: 0 },
      { lastDonationDate: null },
      { lastDonationDate: { $lte: cooldownDate } },
    ];

    const donors = await DonorProfile.find(query)
      .populate('userId', 'name email avatar phone')
      .limit(100);

    res.json({ donors, count: donors.length });
  } catch (error) {
    console.error('Get compatible donors error:', error);
    res.status(500).json({ error: 'Failed to get compatible donors' });
  }
};

/**
 * GET /api/donors/all - Get all donors (admin)
 */
exports.getAllDonors = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [donors, total] = await Promise.all([
      DonorProfile.find()
        .populate('userId', 'name email avatar phone')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      DonorProfile.countDocuments(),
    ]);

    res.json({
      donors,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get all donors error:', error);
    res.status(500).json({ error: 'Failed to get donors' });
  }
};

// ============================================================
// Haversine Distance Calculation
// ============================================================
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

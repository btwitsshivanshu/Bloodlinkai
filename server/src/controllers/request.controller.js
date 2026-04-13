// ============================================================
// Request Controller - Blood request management
// ============================================================
const BloodRequest = require('../models/BloodRequest');
const Notification = require('../models/Notification');
const DonorProfile = require('../models/DonorProfile');
const axios = require('axios');

// Blood compatibility matrix
const COMPATIBILITY = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'],
};

// Which blood groups can donate to a given receiver
function getCompatibleDonorGroups(receiverGroup) {
  const compatible = [];
  for (const [donor, receivers] of Object.entries(COMPATIBILITY)) {
    if (receivers.includes(receiverGroup)) {
      compatible.push(donor);
    }
  }
  return compatible;
}

/**
 * POST /api/requests - Create a new blood request
 */
exports.createRequest = async (req, res) => {
  try {
    const { bloodGroup, units, lat, lng, address, hospital, description, contactPhone, requiredBy } = req.body;

    // Auto-classify urgency using AI service
    let urgency = 'normal';
    try {
      const aiUrl = process.env.AI_SERVICE_URL || 'http://16.171.162.8:8000';
      const aiResponse = await axios.post(`${aiUrl}/api/classify-urgency`, {
        description: description || '',
        units,
        hospital,
      }, { timeout: 5000 });
      urgency = aiResponse.data.urgency || 'normal';
    } catch (aiErr) {
      // Fallback: simple classification
      if (description) {
        const criticalWords = ['emergency', 'urgent', 'critical', 'accident', 'surgery', 'bleeding', 'trauma'];
        const lower = description.toLowerCase();
        if (criticalWords.some(w => lower.includes(w)) || units >= 4) {
          urgency = 'critical';
        } else if (units >= 2) {
          urgency = 'moderate';
        }
      }
    }

    const request = await BloodRequest.create({
      receiverId: req.userId,
      receiverName: req.user.name,
      bloodGroup,
      units,
      urgency,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      address,
      hospital,
      description: description || '',
      contactPhone: contactPhone || '',
      requiredBy: requiredBy ? new Date(requiredBy) : null,
    });

    // Notify compatible donors nearby
    let nearbyDonors = [];
    try {
      const compatibleGroups = getCompatibleDonorGroups(bloodGroup);
      nearbyDonors = await DonorProfile.find({
        available: true,
        bloodGroup: { $in: compatibleGroups },
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 50000, // 50km
          },
        },
      }).limit(20);

      // Create notifications for matching donors
      const notifications = nearbyDonors.map(donor => ({
        userId: donor.userId,
        type: 'request',
        title: `🩸 ${urgency.toUpperCase()} Blood Request`,
        message: `${req.user.name} needs ${units} unit(s) of ${bloodGroup} blood at ${hospital}`,
        link: `/requests/${request._id}`,
        metadata: { requestId: request._id },
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      // Emit real-time notification via Socket.io
      const io = req.app.get('io');
      if (io) {
        nearbyDonors.forEach(donor => {
          io.to(donor.userId.toString()).emit('new-request', {
            request,
            message: `New ${urgency} blood request for ${bloodGroup}`,
          });
        });
      }
    } catch (notifyErr) {
      console.error('Donor notification error (non-fatal):', notifyErr.message);
    }

    res.status(201).json({
      message: 'Blood request created',
      request,
      urgency,
      notifiedDonors: nearbyDonors.length,
    });
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
};

/**
 * GET /api/requests - Get requests with filters
 */
exports.getRequests = async (req, res) => {
  try {
    const { status, bloodGroup, urgency, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (urgency) filter.urgency = urgency;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      BloodRequest.find(filter)
        .populate('receiverId', 'name email avatar')
        .populate('matchedDonorId', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      BloodRequest.countDocuments(filter),
    ]);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
};

/**
 * GET /api/requests/my - Get current user's requests
 */
exports.getMyRequests = async (req, res) => {
  try {
    const requests = await BloodRequest.find({ receiverId: req.userId })
      .populate('matchedDonorId', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json({ requests });
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
};

/**
 * GET /api/requests/:id - Get single request
 */
exports.getRequestById = async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
      .populate('receiverId', 'name email avatar phone')
      .populate('matchedDonorId', 'name email avatar phone');

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Failed to get request' });
  }
};

/**
 * PUT /api/requests/:id - Update request
 */
exports.updateRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Only owner or admin can update
    if (request.receiverId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = req.body;
    delete updates.receiverId; // Prevent changing owner

    if (updates.lat && updates.lng) {
      updates.location = {
        type: 'Point',
        coordinates: [updates.lng, updates.lat],
      };
      delete updates.lat;
      delete updates.lng;
    }

    const updated = await BloodRequest.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ message: 'Request updated', request: updated });
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
};

/**
 * PUT /api/requests/:id/status
 */
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const request = await BloodRequest.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // When donation is verified (fulfilled), update the donor's profile stats
    if (status === 'fulfilled' && request.matchedDonorId) {
      const now = new Date();
      await DonorProfile.findOneAndUpdate(
        { userId: request.matchedDonorId },
        {
          $inc: { totalDonations: 1 },
          $set: { lastDonationDate: now, available: false },
          $push: {
            donationHistory: {
              date: now,
              location: request.address || '',
              receiverName: request.receiverName || 'Anonymous',
              bloodGroup: request.bloodGroup,
              units: request.units || 1,
              hospital: request.hospital || '',
            },
          },
        }
      );
    }

    // Emit status update via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(request.receiverId.toString()).emit('request-update', { request });
      if (request.matchedDonorId) {
        io.to(request.matchedDonorId.toString()).emit('request-update', { request });
      }
    }

    res.json({ message: 'Status updated', request });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

/**
 * PUT /api/requests/:id/match - Match donor to request
 */
exports.matchDonor = async (req, res) => {
  try {
    const { donorId } = req.body;

    const request = await BloodRequest.findByIdAndUpdate(
      req.params.id,
      { matchedDonorId: donorId, status: 'matched' },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Notify donor
    await Notification.create({
      userId: donorId,
      type: 'match',
      title: '🎯 You have been matched!',
      message: `You have been matched with ${request.receiverName} for ${request.bloodGroup} blood at ${request.hospital}`,
      link: `/requests/${request._id}`,
    });

    // Real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(donorId).emit('donor-matched', { request });
    }

    res.json({ message: 'Donor matched successfully', request });
  } catch (error) {
    console.error('Match donor error:', error);
    res.status(500).json({ error: 'Failed to match donor' });
  }
};

/**
 * DELETE /api/requests/:id
 */
exports.deleteRequest = async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    if (request.receiverId.toString() !== req.userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await BloodRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request deleted' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
};

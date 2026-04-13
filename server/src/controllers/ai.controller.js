// ============================================================
// AI Controller - Smart matching, predictions, classification
// Proxies to Python AI service with Node.js fallbacks
// ============================================================
const axios = require('axios');
const DonorProfile = require('../models/DonorProfile');
const BloodRequest = require('../models/BloodRequest');

const AI_URL = process.env.AI_SERVICE_URL || 'http://16.171.162.8:8000';

// Blood compatibility: who can donate to whom
const COMPATIBILITY_RECEIVE = {
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};

/**
 * POST /api/ai/match-donors - Smart donor matching
 */
exports.matchDonors = async (req, res) => {
  try {
    const { bloodGroup, lat, lng, urgency, maxDistance } = req.body;
    const radius = (maxDistance || 50) * 1000; // Convert km to meters

    // Get compatible blood groups
    const compatibleGroups = COMPATIBILITY_RECEIVE[bloodGroup] || [bloodGroup];

    // Find nearby compatible donors
    const donors = await DonorProfile.find({
      available: true,
      bloodGroup: { $in: compatibleGroups },
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: radius,
        },
      },
    }).populate('userId', 'name email avatar phone');

    // Try AI service first
    try {
      const aiResponse = await axios.post(`${AI_URL}/api/rank-donors`, {
        request: { bloodGroup, lat, lng, urgency },
        donors: donors.map(d => ({
          id: d._id.toString(),
          userId: d.userId?._id?.toString(),
          name: d.userId?.name,
          email: d.userId?.email,
          avatar: d.userId?.avatar,
          bloodGroup: d.bloodGroup,
          lat: d.location.coordinates[1],
          lng: d.location.coordinates[0],
          available: d.available,
          lastDonationDate: d.lastDonationDate,
          totalDonations: d.totalDonations,
          healthScore: d.healthScore,
        })),
      }, { timeout: 5000 });

      return res.json({
        matches: aiResponse.data.ranked_donors,
        source: 'ai-service',
        count: aiResponse.data.ranked_donors.length,
      });
    } catch (aiErr) {
      // Fallback: Node.js scoring
      console.log('AI service unavailable, using fallback scoring');
    }

    // Fallback scoring in Node.js
    const scored = donors.map(donor => {
      const distance = haversineDistance(
        lat, lng,
        donor.location.coordinates[1], donor.location.coordinates[0]
      );

      // Distance score (closer = higher, max 100)
      const maxDist = maxDistance || 50;
      const distanceScore = Math.max(0, 100 - (distance / maxDist) * 100);

      // Recency score (longer since last donation = higher eligibility)
      let recencyScore = 100;
      if (donor.lastDonationDate) {
        const daysSince = (Date.now() - new Date(donor.lastDonationDate).getTime()) / (1000 * 60 * 60 * 24);
        recencyScore = Math.min(100, (daysSince / 56) * 100); // 56 days = full eligibility
      }

      // Availability bonus
      const availabilityScore = donor.available ? 100 : 0;

      // Exact match bonus
      const compatibilityScore = donor.bloodGroup === bloodGroup ? 100 : 70;

      // Weighted score
      const score = (
        0.35 * distanceScore +
        0.20 * recencyScore +
        0.25 * availabilityScore +
        0.20 * compatibilityScore
      );

      return {
        donor: {
          id: donor._id,
          userId: donor.userId?._id,
          name: donor.userId?.name || 'Unknown',
          email: donor.userId?.email || '',
          avatar: donor.userId?.avatar || '',
          bloodGroup: donor.bloodGroup,
          totalDonations: donor.totalDonations,
          healthScore: donor.healthScore,
          lastDonationDate: donor.lastDonationDate,
        },
        score: Math.round(score * 10) / 10,
        distance: Math.round(distance * 10) / 10,
        distanceScore: Math.round(distanceScore),
        recencyScore: Math.round(recencyScore),
        availabilityScore,
        compatibilityScore,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    res.json({
      matches: scored,
      source: 'node-fallback',
      count: scored.length,
    });
  } catch (error) {
    console.error('Match donors error:', error);
    res.status(500).json({ error: 'Failed to match donors' });
  }
};

/**
 * POST /api/ai/classify-urgency - Classify request urgency
 */
exports.classifyUrgency = async (req, res) => {
  try {
    const { description, units } = req.body;

    // Try AI service
    try {
      const aiResponse = await axios.post(`${AI_URL}/api/classify-urgency`, {
        description, units,
      }, { timeout: 5000 });
      return res.json(aiResponse.data);
    } catch (aiErr) {
      // Fallback
    }

    // Fallback classification
    const result = classifyUrgencyFallback(description, units);
    res.json(result);
  } catch (error) {
    console.error('Classify urgency error:', error);
    res.status(500).json({ error: 'Classification failed' });
  }
};

/**
 * GET /api/ai/demand-prediction - Predict blood demand
 */
exports.demandPrediction = async (req, res) => {
  try {
    // Try AI service
    try {
      const aiResponse = await axios.get(`${AI_URL}/api/demand-prediction`, {
        timeout: 5000,
      });
      return res.json(aiResponse.data);
    } catch (aiErr) {
      // Fallback
    }

    // Fallback: aggregate from database
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const predictions = [];

    for (const bg of bloodGroups) {
      const count = await BloodRequest.countDocuments({
        bloodGroup: bg,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });

      const prevCount = await BloodRequest.countDocuments({
        bloodGroup: bg,
        createdAt: {
          $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      });

      const trend = count > prevCount ? 'increasing' : count < prevCount ? 'decreasing' : 'stable';
      const predicted = Math.round(count * (count > prevCount ? 1.15 : count < prevCount ? 0.9 : 1.0));

      predictions.push({
        bloodGroup: bg,
        currentDemand: count,
        predictedDemand: Math.max(predicted, 1),
        trend,
        confidence: 0.72,
      });
    }

    res.json({ predictions, source: 'node-fallback' });
  } catch (error) {
    console.error('Demand prediction error:', error);
    res.status(500).json({ error: 'Prediction failed' });
  }
};

/**
 * POST /api/ai/check-eligibility - Check donor eligibility
 */
exports.checkEligibility = async (req, res) => {
  try {
    const { age, weight, lastDonationDate, healthScore } = req.body;

    const issues = [];
    let eligible = true;

    if (age < 18) { issues.push('Must be at least 18 years old'); eligible = false; }
    if (age > 65) { issues.push('Must be 65 or younger'); eligible = false; }
    if (weight < 50) { issues.push('Must weigh at least 50 kg'); eligible = false; }

    if (lastDonationDate) {
      const daysSince = (Date.now() - new Date(lastDonationDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 56) {
        issues.push(`Must wait ${Math.ceil(56 - daysSince)} more days since last donation`);
        eligible = false;
      }
    }

    if (healthScore && healthScore < 60) {
      issues.push('Health score too low (minimum 60)');
      eligible = false;
    }

    res.json({
      eligible,
      issues,
      nextEligibleDate: lastDonationDate
        ? new Date(new Date(lastDonationDate).getTime() + 56 * 24 * 60 * 60 * 1000).toISOString()
        : null,
    });
  } catch (error) {
    console.error('Eligibility check error:', error);
    res.status(500).json({ error: 'Eligibility check failed' });
  }
};

/**
 * POST /api/ai/detect-fraud - Detect suspicious requests
 */
exports.detectFraud = async (req, res) => {
  try {
    const { description, units, hospital } = req.body;

    // Try AI service
    try {
      const aiResponse = await axios.post(`${AI_URL}/api/detect-fraud`, {
        description, units, hospital,
      }, { timeout: 5000 });
      return res.json(aiResponse.data);
    } catch (aiErr) {
      // Fallback
    }

    // Fallback fraud detection
    let riskScore = 0;
    const flags = [];

    if (units > 5) { riskScore += 30; flags.push('Unusually high unit count'); }
    if (description.length < 10) { riskScore += 20; flags.push('Very short description'); }
    if (!hospital || hospital.length < 3) { riskScore += 25; flags.push('No valid hospital specified'); }

    // Check for spam patterns
    const spamWords = ['free', 'money', 'pay', 'scam', 'lottery'];
    if (spamWords.some(w => description.toLowerCase().includes(w))) {
      riskScore += 40;
      flags.push('Contains suspicious keywords');
    }

    res.json({
      riskScore: Math.min(riskScore, 100),
      isSuspicious: riskScore > 50,
      flags,
      recommendation: riskScore > 50 ? 'Review required' : 'Appears legitimate',
    });
  } catch (error) {
    console.error('Fraud detection error:', error);
    res.status(500).json({ error: 'Fraud detection failed' });
  }
};

/**
 * POST /api/ai/chatbot - FAQ Chatbot
 */
exports.chatbot = async (req, res) => {
  try {
    const { message } = req.body;

    // Try AI service
    try {
      const aiResponse = await axios.post(`${AI_URL}/api/chatbot`, {
        message,
      }, { timeout: 5000 });
      return res.json(aiResponse.data);
    } catch (aiErr) {
      // Fallback
    }

    // Fallback chatbot
    const response = chatbotFallback(message);
    res.json(response);
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ error: 'Chatbot failed' });
  }
};

// ============================================================
// Helper Functions
// ============================================================

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * Math.PI / 180; }

function classifyUrgencyFallback(description, units) {
  const lower = (description || '').toLowerCase();
  const criticalWords = ['emergency', 'accident', 'surgery', 'critical', 'trauma', 'bleeding', 'dying', 'life-threatening'];
  const moderateWords = ['urgent', 'operation', 'scheduled', 'procedure', 'anemia', 'transfusion'];

  let criticalScore = 0;
  let moderateScore = 0;

  criticalWords.forEach(w => { if (lower.includes(w)) criticalScore += 1; });
  moderateWords.forEach(w => { if (lower.includes(w)) moderateScore += 1; });

  if (units >= 4) criticalScore += 1;
  else if (units >= 2) moderateScore += 1;

  let urgency = 'normal';
  let confidence = 0.6;

  if (criticalScore >= 2 || (criticalScore >= 1 && units >= 4)) {
    urgency = 'critical'; confidence = 0.85;
  } else if (criticalScore >= 1 || moderateScore >= 1) {
    urgency = 'moderate'; confidence = 0.75;
  }

  return { urgency, confidence, scores: { critical: criticalScore, moderate: moderateScore } };
}

function chatbotFallback(message) {
  const lower = message.toLowerCase();
  const faqs = [
    { keywords: ['eligible', 'can i donate', 'requirements', 'qualify'], answer: 'To donate blood, you must be 18-65 years old, weigh at least 50 kg, and wait at least 56 days between donations. You should be in good health and not have any active infections.' },
    { keywords: ['how often', 'frequency', 'wait', 'interval'], answer: 'You can donate whole blood every 56 days (8 weeks). Platelet donations can be made every 7 days, up to 24 times per year.' },
    { keywords: ['blood type', 'blood group', 'compatible', 'compatibility'], answer: 'Blood compatibility: O- is the universal donor, AB+ is the universal receiver. A+ can receive from A+, A-, O+, O-. B+ can receive from B+, B-, O+, O-.' },
    { keywords: ['side effect', 'risk', 'safe', 'danger'], answer: 'Blood donation is very safe. Common mild side effects include slight dizziness, bruising at the needle site, and fatigue. These usually resolve within a few hours.' },
    { keywords: ['prepare', 'before', 'eat', 'drink'], answer: 'Before donating: eat iron-rich foods, drink plenty of water, get a good night\'s sleep, and avoid alcohol for 24 hours. Bring a valid ID to the donation center.' },
    { keywords: ['process', 'how long', 'procedure', 'steps'], answer: 'The donation process takes about 1 hour total: registration (10 min), health screening (10 min), actual donation (8-10 min), and rest/refreshments (15 min).' },
    { keywords: ['emergency', 'urgent', 'need blood now'], answer: 'For emergency blood needs, create a request with "Critical" urgency. Our AI will immediately match you with the nearest compatible donors and send real-time notifications.' },
  ];

  for (const faq of faqs) {
    if (faq.keywords.some(k => lower.includes(k))) {
      return { answer: faq.answer, confidence: 0.85, source: 'faq' };
    }
  }

  return {
    answer: 'I\'m BloodLink AI assistant. I can help with questions about blood donation eligibility, blood types, donation process, and safety. Try asking "Can I donate blood?" or "What blood types are compatible?"',
    confidence: 0.4,
    source: 'default',
  };
}

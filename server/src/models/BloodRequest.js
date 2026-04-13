// ============================================================
// Blood Request Model - Receiver blood requests
// ============================================================
const mongoose = require('mongoose');

const bloodRequestSchema = new mongoose.Schema({
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverName: {
    type: String,
    required: true,
  },
  bloodGroup: {
    type: String,
    required: [true, 'Blood group is required'],
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  },
  units: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
  },
  urgency: {
    type: String,
    enum: ['critical', 'moderate', 'normal'],
    default: 'normal',
  },
  status: {
    type: String,
    enum: ['open', 'matched', 'fulfilled', 'cancelled'],
    default: 'open',
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
  },
  address: {
    type: String,
    required: true,
  },
  hospital: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000,
  },
  matchedDonorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  contactPhone: {
    type: String,
    default: '',
  },
  requiredBy: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Indexes
bloodRequestSchema.index({ location: '2dsphere' });
bloodRequestSchema.index({ bloodGroup: 1 });
bloodRequestSchema.index({ status: 1 });
bloodRequestSchema.index({ urgency: 1 });
bloodRequestSchema.index({ receiverId: 1 });
bloodRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('BloodRequest', bloodRequestSchema);

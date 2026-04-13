// ============================================================
// Donor Profile Model - Extended donor information
// ============================================================
const mongoose = require('mongoose');

const donationRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  location: { type: String, required: true },
  receiverName: { type: String, default: 'Anonymous' },
  bloodGroup: { type: String, required: true },
  units: { type: Number, default: 1 },
  hospital: { type: String, default: '' },
}, { _id: true, timestamps: false });

const donorProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  bloodGroup: {
    type: String,
    required: [true, 'Blood group is required'],
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
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
    trim: true,
  },
  available: {
    type: Boolean,
    default: true,
  },
  lastDonationDate: {
    type: Date,
    default: null,
  },
  totalDonations: {
    type: Number,
    default: 0,
    min: 0,
  },
  donationHistory: [donationRecordSchema],
  healthScore: {
    type: Number,
    default: 85,
    min: 0,
    max: 100,
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 65,
  },
  weight: {
    type: Number,
    required: true,
    min: 50, // kg
  },
}, {
  timestamps: true,
});

// Geospatial index for location-based queries
donorProfileSchema.index({ location: '2dsphere' });
donorProfileSchema.index({ bloodGroup: 1 });
donorProfileSchema.index({ available: 1 });
donorProfileSchema.index({ userId: 1 });

module.exports = mongoose.model('DonorProfile', donorProfileSchema);

// ============================================================
// Database Seed Script - Populate with sample data
// Run: node src/seed.js
// ============================================================
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const DonorProfile = require('./models/DonorProfile');
const BloodRequest = require('./models/BloodRequest');
const Notification = require('./models/Notification');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/bloodlink-ai';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      DonorProfile.deleteMany({}),
      BloodRequest.deleteMany({}),
      Notification.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Hash password
    const password = await bcrypt.hash('password123', 12);

    // ============================================================
    // Create Users
    // ============================================================
    const users = await User.insertMany([
      {
        name: 'Admin User',
        email: 'admin@bloodlink.ai',
        password,
        role: 'admin',
        phone: '+1-555-0100',
        avatar: 'https://ui-avatars.com/api/?name=Admin+User&background=dc2626&color=fff',
        isVerified: true,
      },
      {
        name: 'Rajesh Kumar',
        email: 'rajesh@example.com',
        password,
        role: 'donor',
        phone: '+91-9876543210',
        avatar: 'https://ui-avatars.com/api/?name=Rajesh+Kumar&background=dc2626&color=fff',
        isVerified: true,
      },
      {
        name: 'Priya Sharma',
        email: 'priya@example.com',
        password,
        role: 'donor',
        phone: '+91-9876543211',
        avatar: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=dc2626&color=fff',
        isVerified: true,
      },
      {
        name: 'Amit Patel',
        email: 'amit@example.com',
        password,
        role: 'donor',
        phone: '+91-9876543212',
        avatar: 'https://ui-avatars.com/api/?name=Amit+Patel&background=dc2626&color=fff',
        isVerified: true,
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah@example.com',
        password,
        role: 'donor',
        phone: '+1-555-0101',
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=dc2626&color=fff',
        isVerified: true,
      },
      {
        name: 'Mohammed Ali',
        email: 'mohammed@example.com',
        password,
        role: 'donor',
        phone: '+91-9876543213',
        avatar: 'https://ui-avatars.com/api/?name=Mohammed+Ali&background=dc2626&color=fff',
        isVerified: true,
      },
      {
        name: 'Sneha Reddy',
        email: 'sneha@example.com',
        password,
        role: 'receiver',
        phone: '+91-9876543214',
        avatar: 'https://ui-avatars.com/api/?name=Sneha+Reddy&background=2563eb&color=fff',
        isVerified: true,
      },
      {
        name: 'David Chen',
        email: 'david@example.com',
        password,
        role: 'receiver',
        phone: '+1-555-0102',
        avatar: 'https://ui-avatars.com/api/?name=David+Chen&background=2563eb&color=fff',
        isVerified: true,
      },
      {
        name: 'Anita Desai',
        email: 'anita@example.com',
        password,
        role: 'receiver',
        phone: '+91-9876543215',
        avatar: 'https://ui-avatars.com/api/?name=Anita+Desai&background=2563eb&color=fff',
        isVerified: true,
      },
      {
        name: 'John Smith',
        email: 'john@example.com',
        password,
        role: 'donor',
        phone: '+1-555-0103',
        avatar: 'https://ui-avatars.com/api/?name=John+Smith&background=dc2626&color=fff',
        isVerified: true,
      },
    ]);

    console.log(`Created ${users.length} users`);

    // ============================================================
    // Create Donor Profiles
    // ============================================================
    const donorUsers = users.filter(u => u.role === 'donor');
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    // Locations around Delhi, Mumbai, and New York
    const locations = [
      { lat: 28.6139, lng: 77.2090, address: 'Connaught Place, New Delhi' },
      { lat: 28.5355, lng: 77.3910, address: 'Noida, Uttar Pradesh' },
      { lat: 19.0760, lng: 72.8777, address: 'Mumbai, Maharashtra' },
      { lat: 28.7041, lng: 77.1025, address: 'Rohini, Delhi' },
      { lat: 40.7128, lng: -74.0060, address: 'Manhattan, New York' },
      { lat: 28.4595, lng: 77.0266, address: 'Gurugram, Haryana' },
    ];

    const donorProfiles = await DonorProfile.insertMany(
      donorUsers.map((user, i) => {
        const loc = locations[i % locations.length];
        const daysAgo = Math.floor(Math.random() * 120) + 30;
        return {
          userId: user._id,
          bloodGroup: bloodGroups[i % bloodGroups.length],
          location: {
            type: 'Point',
            coordinates: [loc.lng, loc.lat],
          },
          address: loc.address,
          available: i !== 3, // One donor unavailable
          lastDonationDate: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
          totalDonations: Math.floor(Math.random() * 15) + 1,
          donationHistory: [
            {
              date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
              location: loc.address,
              receiverName: 'City Hospital Patient',
              bloodGroup: bloodGroups[i % bloodGroups.length],
              units: 1,
              hospital: 'City Hospital',
            },
            {
              date: new Date(Date.now() - (daysAgo + 90) * 24 * 60 * 60 * 1000),
              location: loc.address,
              receiverName: 'Blood Bank',
              bloodGroup: bloodGroups[i % bloodGroups.length],
              units: 1,
              hospital: 'Red Cross Center',
            },
          ],
          healthScore: 75 + Math.floor(Math.random() * 25),
          age: 22 + Math.floor(Math.random() * 30),
          weight: 55 + Math.floor(Math.random() * 35),
        };
      })
    );

    console.log(`Created ${donorProfiles.length} donor profiles`);

    // ============================================================
    // Create Blood Requests
    // ============================================================
    const receiverUsers = users.filter(u => u.role === 'receiver');

    const requests = await BloodRequest.insertMany([
      {
        receiverId: receiverUsers[0]._id,
        receiverName: receiverUsers[0].name,
        bloodGroup: 'O+',
        units: 2,
        urgency: 'critical',
        status: 'open',
        location: { type: 'Point', coordinates: [77.2090, 28.6139] },
        address: 'AIIMS Hospital, New Delhi',
        hospital: 'AIIMS Hospital',
        description: 'Emergency surgery - patient needs O+ blood urgently. Accident victim.',
        contactPhone: receiverUsers[0].phone,
      },
      {
        receiverId: receiverUsers[1]._id,
        receiverName: receiverUsers[1].name,
        bloodGroup: 'A+',
        units: 3,
        urgency: 'moderate',
        status: 'open',
        location: { type: 'Point', coordinates: [72.8777, 19.0760] },
        address: 'Lilavati Hospital, Mumbai',
        hospital: 'Lilavati Hospital',
        description: 'Scheduled surgery next week. Need A+ blood for transfusion during operation.',
        contactPhone: receiverUsers[1].phone,
      },
      {
        receiverId: receiverUsers[2]._id,
        receiverName: receiverUsers[2].name,
        bloodGroup: 'B-',
        units: 1,
        urgency: 'normal',
        status: 'open',
        location: { type: 'Point', coordinates: [77.3910, 28.5355] },
        address: 'Fortis Hospital, Noida',
        hospital: 'Fortis Hospital',
        description: 'Regular transfusion needed for thalassemia patient.',
        contactPhone: receiverUsers[2].phone,
      },
      {
        receiverId: receiverUsers[0]._id,
        receiverName: receiverUsers[0].name,
        bloodGroup: 'AB+',
        units: 4,
        urgency: 'critical',
        status: 'matched',
        matchedDonorId: donorUsers[0]._id,
        location: { type: 'Point', coordinates: [77.1025, 28.7041] },
        address: 'Max Hospital, Rohini',
        hospital: 'Max Hospital',
        description: 'Critical trauma case. Multiple units needed immediately.',
        contactPhone: receiverUsers[0].phone,
      },
      {
        receiverId: receiverUsers[1]._id,
        receiverName: receiverUsers[1].name,
        bloodGroup: 'O-',
        units: 2,
        urgency: 'moderate',
        status: 'fulfilled',
        matchedDonorId: donorUsers[1]._id,
        location: { type: 'Point', coordinates: [-74.0060, 40.7128] },
        address: 'Mount Sinai Hospital, NYC',
        hospital: 'Mount Sinai Hospital',
        description: 'Pre-surgical blood arrangement completed successfully.',
        contactPhone: receiverUsers[1].phone,
      },
    ]);

    console.log(`Created ${requests.length} blood requests`);

    // ============================================================
    // Create Notifications
    // ============================================================
    const notifications = await Notification.insertMany([
      {
        userId: donorUsers[0]._id,
        type: 'request',
        title: '🩸 Critical Blood Request',
        message: `${receiverUsers[0].name} needs 2 units of O+ blood at AIIMS Hospital`,
        read: false,
      },
      {
        userId: donorUsers[1]._id,
        type: 'match',
        title: '🎯 You have been matched!',
        message: 'You have been matched with a patient at Max Hospital for AB+ blood',
        read: false,
      },
      {
        userId: receiverUsers[0]._id,
        type: 'system',
        title: '✅ Request Fulfilled',
        message: 'Your blood request for O- has been fulfilled successfully',
        read: true,
      },
    ]);

    console.log(`Created ${notifications.length} notifications`);

    // ============================================================
    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Admin:    admin@bloodlink.ai / password123');
    console.log('   Donor:    rajesh@example.com / password123');
    console.log('   Receiver: sneha@example.com / password123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();

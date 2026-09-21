const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Equipment = require('../models/Equipment');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onetake');
  console.log('Connected to DB');

  // Clear existing
  await User.deleteMany({});
  await Equipment.deleteMany({});

  // Create admin
  await User.create({
    name: 'OneTake Admin',
    email: 'admin@onetake.com',
    password: 'admin123',
    role: 'admin',
    phone: '+63-900-000-0001'
  });

  // Create sample client
  await User.create({
    name: 'Maria Santos',
    email: 'client@onetake.com',
    password: 'client123',
    role: 'client',
    phone: '+63-900-000-0002',
    address: 'Makati City, Metro Manila'
  });

  // Create freelancers
  await User.create([
    {
      name: 'Juan dela Cruz',
      email: 'audio@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Audio Engineer', 'Sound System Setup'],
      hourlyRate: 1500,
      rating: 4.8,
      bio: '5+ years audio engineering for corporate events and concerts'
    },
    {
      name: 'Ana Reyes',
      email: 'lights@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Lighting Technician', 'LED Programming'],
      hourlyRate: 1200,
      rating: 4.7,
      bio: 'Expert in event lighting design and DMX programming'
    },
    {
      name: 'Carlo Mendoza',
      email: 'video@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Videographer', 'SDE Editor', 'Cinematographer'],
      hourlyRate: 2000,
      rating: 5.0,
      bio: 'Award-winning wedding and events videographer'
    },
    {
      name: 'Lisa Torres',
      email: 'photo@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Photographer', 'Photo Editing'],
      hourlyRate: 1800,
      rating: 4.9,
      bio: 'Professional photographer specializing in events and portraiture'
    }
  ]);

  // Equipment
  await Equipment.create([
    { name: 'PA System (Medium)', category: 'sounds', quantity: 2, availableQuantity: 2, dailyRate: 5000, condition: 'excellent' },
    { name: 'Line Array Speaker', category: 'sounds', quantity: 4, availableQuantity: 4, dailyRate: 2000, condition: 'good' },
    { name: 'Wireless Microphone', category: 'sounds', quantity: 10, availableQuantity: 10, dailyRate: 500, condition: 'excellent' },
    { name: 'Digital Audio Mixer', category: 'sounds', quantity: 2, availableQuantity: 2, dailyRate: 3000, condition: 'excellent' },
    { name: 'LED Par Light', category: 'lights', quantity: 30, availableQuantity: 30, dailyRate: 300, condition: 'good' },
    { name: 'Moving Head Light', category: 'lights', quantity: 8, availableQuantity: 8, dailyRate: 1500, condition: 'excellent' },
    { name: 'Follow Spot', category: 'lights', quantity: 2, availableQuantity: 2, dailyRate: 2000, condition: 'good' },
    { name: 'Lighting Controller', category: 'lights', quantity: 2, availableQuantity: 2, dailyRate: 2500, condition: 'excellent' },
    { name: 'Cinema Camera (4K)', category: 'video', quantity: 3, availableQuantity: 3, dailyRate: 4000, condition: 'excellent' },
    { name: 'Gimbal Stabilizer', category: 'video', quantity: 2, availableQuantity: 2, dailyRate: 1500, condition: 'good' },
    { name: 'Drone Camera', category: 'video', quantity: 1, availableQuantity: 1, dailyRate: 5000, condition: 'excellent' },
    { name: 'DSLR Camera', category: 'photography', quantity: 3, availableQuantity: 3, dailyRate: 2000, condition: 'excellent' },
    { name: 'Camera Lens Set', category: 'photography', quantity: 3, availableQuantity: 3, dailyRate: 1000, condition: 'good' },
    { name: 'Flash Speedlight', category: 'photography', quantity: 6, availableQuantity: 6, dailyRate: 500, condition: 'excellent' },
    { name: 'LED Video Light', category: 'video', quantity: 4, availableQuantity: 4, dailyRate: 800, condition: 'good' }
  ]);

  console.log('✅ Seed complete!');
  console.log('Admin: admin@onetake.com / admin123');
  console.log('Client: client@onetake.com / client123');
  console.log('Freelancer: audio@onetake.com / freelancer123');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const Equipment = require('../models/Equipment');

// Creates a user only if that email doesn't already exist — never touches
// or overwrites an existing account, so this is safe to run more than once.
const ensureUser = async (data) => {
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    console.log(`↷ Skipped (already exists): ${data.email}`);
    return;
  }
  await User.create(data);
  console.log(`✅ Created: ${data.email}`);
};

// Same idea for equipment — matched by name, since there's no unique email here.
const ensureEquipment = async (data) => {
  const existing = await Equipment.findOne({ name: data.name });
  if (existing) {
    console.log(`↷ Skipped (already exists): ${data.name}`);
    return;
  }
  await Equipment.create(data);
  console.log(`✅ Created: ${data.name}`);
};

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/onetake');
  console.log('Connected to DB');
  console.log('Nothing existing will be deleted — only missing accounts/items are added.\n');

  // Admin
  await ensureUser({
    name: 'OneTake Admin',
    email: 'admin@onetake.com',
    password: 'admin123',
    role: 'admin',
    phone: '+63-900-000-0001',
    emailVerified: true, // required — accounts created outside the register flow default to unverified and can't log in
  });

  // Sample client
  await ensureUser({
    name: 'Maria Santos',
    email: 'client@onetake.com',
    password: 'client123',
    role: 'client',
    phone: '+63-900-000-0002',
    address: 'Makati City, Metro Manila',
    emailVerified: true,
  });

  // Additional clients
  await ensureUser({
    name: 'Charlene Jaena',
    email: 'charlene@onetake.com',
    password: 'client123',
    role: 'client',
    phone: '+63-900-000-0003',
    address: 'Makati City, Metro Manila',
    emailVerified: true,
  });

  await ensureUser({
    name: 'Deo Saique',
    email: 'deo@onetake.com',
    password: 'client123',
    role: 'client',
    phone: '+63-900-000-0004',
    address: 'Makati City, Metro Manila',
    emailVerified: true,
  });

  // Freelancers
  const freelancers = [
    {
      name: 'Juan dela Cruz',
      email: 'audio@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Audio Engineer', 'Sound System Setup'],
      hourlyRate: 1500,
      rating: 4.8,
      bio: '5+ years audio engineering for corporate events and concerts',
      emailVerified: true,
    },
    {
      name: 'Ana Reyes',
      email: 'lights@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Lighting Technician', 'LED Programming'],
      hourlyRate: 1200,
      rating: 4.7,
      bio: 'Expert in event lighting design and DMX programming',
      emailVerified: true,
    },
    {
      name: 'Carlo Mendoza',
      email: 'video@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Videographer', 'SDE Editor', 'Cinematographer'],
      hourlyRate: 2000,
      rating: 5.0,
      bio: 'Award-winning wedding and events videographer',
      emailVerified: true,
    },
    {
      name: 'Lisa Torres',
      email: 'photo@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Photographer', 'Photo Editing'],
      hourlyRate: 1800,
      rating: 4.9,
      bio: 'Professional photographer specializing in events and portraiture',
      emailVerified: true,
    },
    {
      name: 'Charles Paolo Estrabela',
      email: 'charles@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Videographer', 'Editor'],
      hourlyRate: 1500,
      rating: 4.8,
      bio: 'Experienced videographer covering corporate and social events',
      emailVerified: true,
    },
    {
      name: 'Kim Angelo Ysulat',
      email: 'kim@onetake.com',
      password: 'freelancer123',
      role: 'freelancer',
      skills: ['Photographer', 'Drone Operator'],
      hourlyRate: 1500,
      rating: 4.8,
      bio: 'Photographer and drone operator for events and coverage',
      emailVerified: true,
    }
  ];
  for (const f of freelancers) await ensureUser(f);

  // Equipment
  const equipment = [
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
  ];
  for (const e of equipment) await ensureEquipment(e);

  console.log('\n✅ Seed complete — existing accounts and events were left untouched.');
  console.log('Admin: admin@onetake.com / admin123');
  console.log('Client: client@onetake.com / client123');
  console.log('Client: charlene@onetake.com / client123');
  console.log('Client: deo@onetake.com / client123');
  console.log('Freelancer: audio@onetake.com / freelancer123');
  console.log('Freelancer: charles@onetake.com / freelancer123');
  console.log('Freelancer: kim@onetake.com / freelancer123');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
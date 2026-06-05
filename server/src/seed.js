// Seed a few demo users + jobs so the app has something to show immediately.
// Run with: npm run seed
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { db } from './db.js';
import { hashPassword } from './auth.js';

db.reset();

// A demo subscription far in the future so gated features work without Stripe.
const activeSub = {
  id: 'demo_sub',
  status: 'active',
  priceId: 'demo_price',
  currentPeriodEnd: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  cancelAtPeriodEnd: false,
};

const contractor = {
  id: randomUUID(),
  role: 'contractor',
  name: 'דני בנייה בע"מ',
  email: 'contractor@demo.com',
  phone: '0501112222',
  passwordHash: hashPassword('demo1234'),
  profile: { company: 'דני בנייה בע"מ', city: 'תל אביב-יפו' },
  verified: true,
  stripeCustomerId: null,
  subscription: activeSub,
  createdAt: new Date().toISOString(),
};

const worker = {
  id: randomUUID(),
  role: 'worker',
  name: 'יוסי כהן',
  email: 'worker@demo.com',
  phone: '0523334444',
  passwordHash: hashPassword('demo1234'),
  profile: { trades: ['חשמלאי', 'גבס'], hourlyRate: 90, experienceYears: 8, city: 'רמת גן' },
  verified: true,
  stripeCustomerId: null,
  subscription: activeSub,
  createdAt: new Date().toISOString(),
};

db.data.users.push(contractor, worker);

// A welcome notification for each demo user.
for (const u of [contractor, worker]) {
  db.data.notifications.push({
    id: randomUUID(),
    userId: u.id,
    type: 'system',
    title: 'ברוכים הבאים לפועלים וקבלנים 🏗️',
    body: 'השלימו את הפרופיל כדי להתחיל לקבל התאמות.',
    data: null,
    read: false,
    createdAt: new Date().toISOString(),
  });
}

db.data.jobs.push(
  {
    id: randomUUID(),
    contractorId: contractor.id,
    title: 'חשמלאי לפרויקט דירות',
    trade: 'חשמלאי',
    description: 'דרוש חשמלאי מוסמך ל-3 דירות בבניין חדש. עבודה ל-3 שבועות.',
    location: 'תל אביב',
    budget: 15000,
    status: 'open',
    createdAt: new Date().toISOString(),
  },
  {
    id: randomUUID(),
    contractorId: contractor.id,
    title: 'עבודות גבס ושפכטל',
    trade: 'גבס',
    description: 'התקנת קירות גבס וביצוע שפכטל בקומת משרדים.',
    location: 'רמת גן',
    budget: 22000,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
);

db.save();

console.log('Seeded demo data:');
console.log('  Contractor login: contractor@demo.com / demo1234');
console.log('  Worker login:     worker@demo.com / demo1234');
console.log(`  Jobs: ${db.data.jobs.length}`);

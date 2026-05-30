// Seed script — populates initial subscription packages
// Run with: pnpm --filter @zenthorax/database db:seed

import { createDb } from './index';
import { subscriptionPackages } from './schema/subscriptions';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

async function seed() {
  const db = createDb(DATABASE_URL!);

  console.log('🌱 Seeding subscription packages...');

  const packages = [
    {
      name: 'Monthly Plan',
      durationMonths: 1,
      priceNrs: 2599,
      registrationFeeNrs: 500,
      description: 'Monthly subscription with all features included. First payment: NRS 3,099.',
    },
    {
      name: '3-Month Plan',
      durationMonths: 3,
      priceNrs: 7000,
      registrationFeeNrs: 500,
      description: '3-month subscription at a discounted rate. First payment: NRS 7,500.',
    },
    {
      name: '6-Month Plan',
      durationMonths: 6,
      priceNrs: 13000,
      registrationFeeNrs: 500,
      description: '6-month subscription with the best value. First payment: NRS 13,500.',
    },
  ];

  for (const pkg of packages) {
    await db.insert(subscriptionPackages).values(pkg).onConflictDoNothing();
    console.log(`  ✓ ${pkg.name} seeded`);
  }

  console.log('✅ Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

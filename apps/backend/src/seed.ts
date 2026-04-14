import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const calendar = await prisma.calendar.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      slug: 'demo',
      name: 'Demo Calendar',
      timezone: 'Europe/Moscow',
      availabilityRules: {
        create: [
          { weekdays: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' },
          { weekdays: [6], startTime: '10:00', endTime: '14:00' },
        ],
      },
      slotDurations: {
        create: [{ minutes: 15 }, { minutes: 30 }],
      },
    },
    include: { availabilityRules: true, slotDurations: true },
  });

  console.log(
    `Seeded calendar: ${calendar.slug} (${calendar.availabilityRules.length} rules, ${calendar.slotDurations.length} durations)`,
  );
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

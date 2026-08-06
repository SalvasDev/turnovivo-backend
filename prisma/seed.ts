import { PrismaClient, Role, SlotStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const DEMO_DAYS = 7;
const START_HOUR = 9;
const SLOTS_PER_DAY = 12;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('- Starting to seed the complete TurnoVivo database...');
  await prisma.appointment.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.appointmentSlot.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);
  const staff = await prisma.user.create({
    data: {
      email: 'barbero.estrella@turnovivo.com',
      passwordHash,
      role: Role.STAFF,
    },
  });

  const customer = await prisma.user.create({
    data: {
      id: 'd4d4d4d4-d4d4-d4d4-d4d4-d4d4d4d4d4d4',
      email: 'cliente.real@turnovivo.com',
      passwordHash,
      role: Role.CUSTOMER,
    },
  });

  const business = await prisma.business.create({
    data: {
      name: 'Barbería Premium Elegance',
      slug: 'barberia-premium',
    },
  });

  const slotsData = [];

  for (let dayOffset = 1; dayOffset <= DEMO_DAYS; dayOffset++) {
    const day = new Date();
    day.setDate(day.getDate() + dayOffset);

    for (let i = 0; i < SLOTS_PER_DAY; i++) {
      const slotStart = new Date(day);
      slotStart.setHours(START_HOUR + Math.floor(i / 2), (i % 2) * 30, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotStart.getMinutes() + 30);

      slotsData.push({
        businessId: business.id,
        staffId: staff.id,
        startTime: slotStart,
        endTime: slotEnd,
        status: SlotStatus.AVAILABLE,
      });
    }
  }

  await prisma.appointmentSlot.createMany({ data: slotsData });
  console.log(
    `- Database populated with ${DEMO_DAYS} days of schedule (${slotsData.length} slots)!`,
  );
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

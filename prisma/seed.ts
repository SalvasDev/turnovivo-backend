import { PrismaClient, Role, SlotStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando el sembrado de la base de datos completa de TurnoVivo...');

  // 1. LIMPIAR DATOS
  await prisma.appointment.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.appointmentSlot.deleteMany();
  await prisma.business.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. CREAR USUARIOS CORE
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

  // 3. CREAR EL NEGOCIO
  const business = await prisma.business.create({
    data: {
      name: 'Barbería Premium Elegance',
      slug: 'barberia-premium',
    },
  });

  // 4. GENERAR JORNADA COMPLETA AUTOMATIZADA (9:00 AM a 3:00 PM)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const slotsData = [];
  const startHour = 9;
  const totalSlots = 12; // 12 bloques de 30 minutos = 6 horas de jornada

  for (let i = 0; i < totalSlots; i++) {
    const slotStart = new Date(tomorrow);
    slotStart.setHours(startHour + Math.floor(i / 2), (i % 2) * 30, 0, 0);

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

  await prisma.appointmentSlot.createMany({ data: slotsData });
  console.log(`🎉 ¡Base de datos sembrada con la agenda completa de mañana (12 turnos secuenciales)!`);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
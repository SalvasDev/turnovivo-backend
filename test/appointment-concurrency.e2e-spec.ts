import { ConflictException } from '@nestjs/common';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { AppointmentsService } from '../src/appointments/appointments.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Appointments Concurrency (e2e + Testcontainers)', () => {
  let container: any;
  let prisma: PrismaService;
  let service: AppointmentsService;

  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const ids = {
    business: '11111111-1111-4111-8111-111111111111',
    staff: '22222222-2222-4222-8222-222222222222',
    customerA: '33333333-3333-4333-8333-333333333333',
    customerB: '44444444-4444-4444-8444-444444444444',
    slot: '55555555-5555-4555-8555-555555555555',
  };

  beforeAll(async () => {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');

    container = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('turnovivo_test_db')
      .withUsername('test_admin')
      .withPassword('test_secret_pass')
      .start();

    const databaseUrl = container.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;

    execSync('npx prisma db push', {
      cwd: join(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaService();
    await prisma.onModuleInit();

    service = new AppointmentsService(prisma, redisMock as any);

    await prisma.user.createMany({
      data: [
        {
          id: ids.staff,
          email: 'barbero@turnovivo.com',
          passwordHash: 'hash-staff',
          role: 'STAFF',
        },
        {
          id: ids.customerA,
          email: 'cliente.a@turnovivo.com',
          passwordHash: 'hash-a',
          role: 'CUSTOMER',
        },
        {
          id: ids.customerB,
          email: 'cliente.b@turnovivo.com',
          passwordHash: 'hash-b',
          role: 'CUSTOMER',
        },
      ],
    });

    await prisma.business.create({
      data: {
        id: ids.business,
        name: 'Barberia Premium Test',
        slug: 'barberia-premium-test',
      },
    });

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const end = new Date(tomorrow.getTime() + 30 * 60 * 1000);

    await prisma.appointmentSlot.create({
      data: {
        id: ids.slot,
        businessId: ids.business,
        staffId: ids.staff,
        startTime: tomorrow,
        endTime: end,
        status: 'AVAILABLE',
      },
    });
  }, 120000);

  afterAll(async () => {
    if (prisma) {
      await prisma.onModuleDestroy();
    }

    if (container) {
      await container.stop();
    }
  }, 60000);

  it('permite una sola reserva bajo carrera concurrente (201/409 equivalente)', async () => {
    const [a, b] = await Promise.allSettled([
      service.bookAppointment(ids.customerA, { slotId: ids.slot }),
      service.bookAppointment(ids.customerB, { slotId: ids.slot }),
    ]);

    const fulfilled = [a, b].filter((r) => r.status === 'fulfilled');
    const rejected = [a, b].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ConflictException);

    const appointments = await prisma.appointment.findMany({ where: { slotId: ids.slot } });
    expect(appointments).toHaveLength(1);

    const slot = await prisma.appointmentSlot.findUnique({ where: { id: ids.slot } });
    expect(slot?.status).toBe('RESERVED');
  });
});

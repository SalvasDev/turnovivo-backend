import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { SlotStatus } from '@prisma/client';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;
  let redis: any;

  beforeEach(() => {
    prisma = {
      business: { findUnique: jest.fn() },
      appointmentSlot: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      slotBlock: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      waitlistEntry: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        deleteMany: jest.fn(),
      },
      appointment: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    service = new AppointmentsService(prisma, redis);
  });

  it('debe lanzar NotFound al crear slot si negocio no existe', async () => {
    prisma.business.findUnique.mockResolvedValue(null);

    await expect(
      service.createSlot('staff-1', {
        businessId: 'biz-1',
        startTime: new Date(Date.now() + 60_000).toISOString(),
        endTime: new Date(Date.now() + 120_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('debe lanzar Conflict si startTime es mayor o igual a endTime', async () => {
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1' });

    const now = new Date(Date.now() + 120_000).toISOString();
    await expect(
      service.createSlot('staff-1', {
        businessId: 'biz-1',
        startTime: now,
        endTime: now,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe bloquear booking si existe SlotBlock para el cliente', async () => {
    const tx = {
      appointmentSlot: {
        findUnique: jest.fn().mockResolvedValue({ id: 'slot-1', status: SlotStatus.AVAILABLE }),
        update: jest.fn(),
      },
      slotBlock: {
        findUnique: jest.fn().mockResolvedValue({ id: 'block-1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    await expect(
      service.bookAppointment('customer-1', { slotId: 'slot-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('debe impedir unirse a waitlist si el slot esta AVAILABLE', async () => {
    prisma.appointmentSlot.findUnique.mockResolvedValue({ id: 'slot-1', status: SlotStatus.AVAILABLE });

    await expect(
      service.joinWaitlist('customer-1', { slotId: 'slot-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe lanzar Conflict al declinar hold cuando expiro o no existe', async () => {
    redis.get.mockResolvedValue(null);

    await expect(service.declineHold('customer-1', 'slot-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe confirmar hold y crear cita cuando el hold pertenece al cliente', async () => {
    redis.get.mockResolvedValue('customer-1');

    const createdAppointment = { id: 'app-1', slotId: 'slot-1', customerId: 'customer-1', status: 'SCHEDULED' };
    const tx = {
      waitlistEntry: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      appointmentSlot: { update: jest.fn().mockResolvedValue({ id: 'slot-1', status: SlotStatus.RESERVED }) },
      appointment: { create: jest.fn().mockResolvedValue(createdAppointment) },
    };

    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

    const result = await service.confirmHold('customer-1', 'slot-1');

    expect(redis.del).toHaveBeenCalledWith('hold:slot-1');
    expect(tx.waitlistEntry.deleteMany).toHaveBeenCalledWith({ where: { slotId: 'slot-1', customerId: 'customer-1' } });
    expect(result).toEqual(createdAppointment);
  });
});

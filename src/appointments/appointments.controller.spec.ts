import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: {
    createSlot: jest.Mock;
    bookAppointment: jest.Mock;
    findAvailableSlots: jest.Mock;
    joinWaitlist: jest.Mock;
    cancelAppointment: jest.Mock;
    confirmHold: jest.Mock;
    declineHold: jest.Mock;
    leaveWaitlist: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      createSlot: jest.fn(),
      bookAppointment: jest.fn(),
      findAvailableSlots: jest.fn(),
      joinWaitlist: jest.fn(),
      cancelAppointment: jest.fn(),
      confirmHold: jest.fn(),
      declineHold: jest.fn(),
      leaveWaitlist: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: AppointmentsService, useValue: service }],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
  });

  it('debe crear slot usando req.user.id', async () => {
    const req = { user: { id: 'staff-1' } };
    const dto = { businessId: 'biz-1', startTime: '2026-01-01T10:00:00.000Z', endTime: '2026-01-01T10:30:00.000Z' };
    service.createSlot.mockResolvedValue({ id: 'slot-1' });

    const result = await controller.createSlot(req, dto as any);

    expect(service.createSlot).toHaveBeenCalledWith('staff-1', dto);
    expect(result).toEqual({ id: 'slot-1' });
  });

  it('debe reservar cita usando req.user.id', async () => {
    const req = { user: { id: 'customer-1' } };
    const dto = { slotId: 'slot-1' };

    await controller.bookAppointment(req, dto as any);

    expect(service.bookAppointment).toHaveBeenCalledWith('customer-1', dto);
  });

  it('debe delegar findAvailableSlots', async () => {
    service.findAvailableSlots.mockResolvedValue([{ id: 'slot-1' }]);

    const result = await controller.findAvailableSlots('biz-1');

    expect(service.findAvailableSlots).toHaveBeenCalledWith('biz-1');
    expect(result).toEqual([{ id: 'slot-1' }]);
  });

  it('debe delegar cancel/confirm/decline/leave usando req.user.id', async () => {
    const req = { user: { id: 'customer-9' } };

    await controller.cancelAppointment(req, 'app-1');
    await controller.confirmHold(req, 'slot-1');
    await controller.declineHold(req, 'slot-1');
    await controller.leaveWaitlist(req, 'slot-1');

    expect(service.cancelAppointment).toHaveBeenCalledWith('customer-9', 'app-1');
    expect(service.confirmHold).toHaveBeenCalledWith('customer-9', 'slot-1');
    expect(service.declineHold).toHaveBeenCalledWith('customer-9', 'slot-1');
    expect(service.leaveWaitlist).toHaveBeenCalledWith('customer-9', 'slot-1');
  });
});

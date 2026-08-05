import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { Appointment, AppointmentSlot, SlotStatus, Prisma } from '@prisma/client';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { RedisService } from '../redis/redis.service';
import { buildHoldKey, HOLD_TTL_SECONDS, isUniqueConstraintError } from './appointments.utils';


@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService, private readonly redisService: RedisService) {}

  async createSlot(staffId: string, createSlotDto: CreateSlotDto): Promise<AppointmentSlot> {
    const { businessId, startTime, endTime } = createSlotDto;
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('El negocio especificado no existe.');
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (start >= end) throw new ConflictException('La fecha de inicio debe ser menor a la de fin.');
    if (start < new Date()) throw new ConflictException('No puedes crear bloques de tiempo en el pasado.');

    return this.prisma.appointmentSlot.create({
      data: {
        businessId,
        staffId,
        startTime: start,
        endTime: end,
        status: SlotStatus.AVAILABLE,
      },
    });
  }

  async bookAppointment(customerId: string, bookAppointmentDto: BookAppointmentDto): Promise<Appointment> {
    const { slotId } = bookAppointmentDto;
    return this.prisma.$transaction(async (tx) => {
      const slot = await tx.appointmentSlot.findUnique({ where: { id: slotId } });
      if (!slot) throw new NotFoundException('El bloque de tiempo solicitado no existe.');

      if (slot.status !== SlotStatus.AVAILABLE) {
        throw new ConflictException('Este turno ya no se encuentra disponible.');
      }
      const block = await tx.slotBlock.findUnique({
        where: { slotId_customerId: { slotId, customerId } },
      });
      if (block) {
        throw new ForbiddenException('Ya no puedes interactuar con este turno.');
      }
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.RESERVED },
      });

      try {
        return await tx.appointment.create({
          data: {
            slotId,
            customerId,
            status: 'SCHEDULED',
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException(`Condición de carrera detectada: Este turno acaba de
            ser reservado por otro cliente.`);
        }
        throw error;
      }
    });
  }
  async findAvailableSlots(businessId: string): Promise<any[]> {
    const slots = await this.prisma.appointmentSlot.findMany({
      where: {
        businessId,
        startTime: { gte: new Date() }, 
      },
      include: {
        appointment: {
          where: { status: 'SCHEDULED' },
          select: { id: true, customerId: true } 
        },
        waitlistEntries: {
          select: { customerId: true }
        },
        slotBlocks: {
          select: { customerId: true, reason: true }
        }
      },
      orderBy: { startTime: 'asc' },
    });
    return Promise.all(
      slots.map(async (slot) => {
        if (slot.status === 'HOLD') {
          const activeUserIdInRedis = await this.redisService.get(buildHoldKey(slot.id));
          return {
            ...slot,
            appointment: activeUserIdInRedis ? { customerId: activeUserIdInRedis } : null,
            waitlistEntries: slot.waitlistEntries 
          };
        }
        return slot;
      })
    );
  }

  async joinWaitlist(customerId: string, joinWaitlistDto: JoinWaitlistDto): Promise<any> {
    const { slotId } = joinWaitlistDto;
    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('El bloque de tiempo solicitado no existe.');
    if (slot.status === SlotStatus.AVAILABLE) {
      throw new ConflictException('Este turno está libre. Puedes agendarlo directamente sin hacer fila.');
    }
    const existingBlock = await this.prisma.slotBlock.findUnique({
      where: { slotId_customerId: { slotId, customerId } },
    });
    if (existingBlock) {
      throw new ForbiddenException('Ya no puedes interactuar con este turno.');
    }
    return this.prisma.$transaction(async (tx) => {
      const highest = await tx.waitlistEntry.aggregate({
        where: { slotId },
        _max: { priority: true },
      });

      const nextPriority = (highest._max.priority ?? 0) + 1;

      try {
        return await tx.waitlistEntry.create({
          data: {
            slotId,
            customerId,
            priority: nextPriority,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new ConflictException('Ya te encuentras registrado en la lista de espera de este turno.');
        }
        throw error;
      }
    });
  }

  async cancelAppointment(customerId: string, appointmentId: string): Promise<any> {
    
    return this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { slot: true },
      });

      if (!appointment) throw new NotFoundException('La cita especificada no existe.');
      const userRunningAction = await tx.user.findUnique({ where: { id: customerId } });
      const isStaffOrAdmin = userRunningAction?.role === 'STAFF' || userRunningAction?.role === 'ADMIN';
      if (appointment.customerId !== customerId && !isStaffOrAdmin) {
        throw new ForbiddenException('No tienes autorización para cancelar esta cita.');
      }

      if (appointment.status === 'CANCELLED') {
        throw new ConflictException('Esta cita ya ha sido cancelada previamente.');
      }
      await tx.appointment.delete({
        where: { id: appointmentId },
      });

      const slotId = appointment.slotId;
      await tx.slotBlock.upsert({
        where: { slotId_customerId: { slotId, customerId: appointment.customerId } },
        create: { slotId, customerId: appointment.customerId, reason: 'CANCELLED' },
        update: { reason: 'CANCELLED' },
      });
      const nextInLine = await this.promoteNextInWaitlist(tx, slotId);
      if (!nextInLine) {
        return { message: 'Cita cancelada con éxito. El horario vuelve a estar disponible al público.' };
      }
      return {
        message: 'Cita cancelada con éxito. El espacio ha sido bloqueado en HOLD.',
        notifiedUserId: nextInLine.customerId,
        expiresInSeconds: HOLD_TTL_SECONDS,
      };
    });
  }

  async confirmHold(customerId: string, slotId: string): Promise<Appointment> {
    const redisKey = buildHoldKey(slotId);
    const activeUserInHold = await this.redisService.get(redisKey);

    if (!activeUserInHold) {
      throw new ConflictException('El tiempo de reserva (Hold) ha expirado o el turno no está disponible.');
    }

    if (activeUserInHold !== customerId) {
      throw new ForbiddenException('No tienes autorización para confirmar este turno reservado.');
    }
    return this.prisma.$transaction(async (tx) => {
      await this.redisService.del(redisKey);
      await tx.waitlistEntry.deleteMany({
        where: { slotId, customerId },
      });
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.RESERVED },
      });
      return await tx.appointment.create({
        data: {
          slotId,
          customerId,
          status: 'SCHEDULED',
        },
      });
    });
  }

  async leaveWaitlist(customerId: string, slotId: string): Promise<{ message: string }> {
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { slotId, customerId },
    });

    if (!entry) {
      throw new NotFoundException('No te encuentras registrado en la lista de espera de este turno.');
    }
    const redisKey = buildHoldKey(slotId);
    const holdOwner = await this.redisService.get(redisKey);
    const wasHoldOwner = holdOwner === customerId;
    if (wasHoldOwner) {
      await this.redisService.del(redisKey);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.waitlistEntry.delete({
        where: { id: entry.id },
      });
      await tx.slotBlock.upsert({
        where: { slotId_customerId: { slotId, customerId } },
        create: { slotId, customerId, reason: 'DECLINED' },
        update: { reason: 'DECLINED' },
      });

      if (wasHoldOwner) {
        await this.promoteNextInWaitlist(tx, slotId);
      }
    });

    return { message: 'Has salido de la lista de espera exitosamente.' };
  }

  async declineHold(customerId: string, slotId: string): Promise<any> {
    const redisKey = buildHoldKey(slotId);

    const activeUserInHold = await this.redisService.get(redisKey);
    if (!activeUserInHold) {
      throw new ConflictException('El tiempo de reserva (Hold) ha expirado o el turno ya no está disponible.');
    }
    if (activeUserInHold !== customerId) {
      throw new ForbiddenException('No tienes autorización para rechazar este turno reservado.');
    }
    await this.redisService.del(redisKey);

    return this.prisma.$transaction(async (tx) => {
      await tx.slotBlock.upsert({
        where: { slotId_customerId: { slotId, customerId } },
        create: { slotId, customerId, reason: 'DECLINED' },
        update: { reason: 'DECLINED' },
      });
      await tx.waitlistEntry.deleteMany({ where: { slotId, customerId } });
      const nextInLine = await this.promoteNextInWaitlist(tx, slotId);

      return {
        message: 'Has rechazado el turno. Se ofrecerá al siguiente en la fila.',
        notifiedUserId: nextInLine?.customerId ?? null,
      };
    });
  }

  async handleHoldExpiration(slotId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const expiredEntry = await tx.waitlistEntry.findFirst({
        where: { slotId },
        orderBy: { priority: 'asc' },
      });

      if (expiredEntry) {
        await tx.slotBlock.upsert({
          where: { slotId_customerId: { slotId, customerId: expiredEntry.customerId } },
          create: { slotId, customerId: expiredEntry.customerId, reason: 'EXPIRED' },
          update: { reason: 'EXPIRED' },
        });
        await tx.waitlistEntry.delete({ where: { id: expiredEntry.id } });
      }
      await this.promoteNextInWaitlist(tx, slotId);
    });
  }
  
  private async promoteNextInWaitlist(
    tx: Prisma.TransactionClient,
    slotId: string,
  ): Promise<{ customerId: string } | null> {
    const nextInLine = await tx.waitlistEntry.findFirst({
      where: { slotId },
      orderBy: { priority: 'asc' },
    });

    if (!nextInLine) {
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.AVAILABLE },
      });
      return null;
    }

    await tx.appointmentSlot.update({
      where: { id: slotId },
      data: { status: SlotStatus.HOLD },
    });
    await this.redisService.set(buildHoldKey(slotId), nextInLine.customerId, 'EX', HOLD_TTL_SECONDS);

    return { customerId: nextInLine.customerId };
  }
}
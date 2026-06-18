import { Controller, Post, Get, Body, Param, UseGuards, Request, HttpStatus, HttpCode } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Controller('appointments') // Ruta base: /appointments
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ENDPOINT 1: Crear Bloques Disponibles (Solo Staff/Barberos o Admins)
  @Post('slots')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSlot(@Request() req: any, @Body() createSlotDto: CreateSlotDto) {
    const staffId = req.user.id; // Extraído de forma segura desde el JWT validado
    return this.appointmentsService.createSlot(staffId, createSlotDto);
  }

  // ENDPOINT 2: Reservar una Cita (Cualquier Cliente autenticado)
  @Post('book')
  @UseGuards(JwtAuthGuard) // Solo requiere login, cualquier rol de usuario puede agendar
  @HttpCode(HttpStatus.CREATED)
  async bookAppointment(@Request() req: any, @Body() bookAppointmentDto: BookAppointmentDto) {
    const customerId = req.user.id;
    return this.appointmentsService.bookAppointment(customerId, bookAppointmentDto);
  }

  // ENDPOINT 3: Consultar Agenda Libre (Público para renderizar en Next.js)
  @Get('business/:businessId/available')
  @HttpCode(HttpStatus.OK)
  async findAvailableSlots(@Param('businessId') businessId: string) {
    return this.appointmentsService.findAvailableSlots(businessId);
  }

  // ENDPOINT 4: Unirse a la Lista de Espera de un turno ocupado
  @Post('waitlist/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async joinWaitlist(@Request() req: any, @Body() joinWaitlistDto: JoinWaitlistDto) {
    const customerId = req.user.id;
    return this.appointmentsService.joinWaitlist(customerId, joinWaitlistDto);
  }

  // ENDPOINT 5: Cancelar una cita activa y detonar el algoritmo TurnoVivo
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(@Request() req: any, @Param('id') appointmentId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.cancelAppointment(customerId, appointmentId);
  }

  // ENDPOINT 6: Confirmar un turno asignado en estado HOLD (Dentro del límite de tiempo)
  @Post('slots/:slotId/confirm-hold')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async confirmHold(@Request() req: any, @Param('slotId') slotId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.confirmHold(customerId, slotId);
  }
   
  // ENDPOINT 7: Salir voluntariamente de la lista de espera
  @Post('slots/:slotId/leave-waitlist')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leaveWaitlist(@Request() req: any, @Param('slotId') slotId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.leaveWaitlist(customerId, slotId);
  }
}



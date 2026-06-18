import { Controller, Post, Get, Body, Param, UseGuards, Request, HttpStatus, HttpCode } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}
  @Post('slots')
  @Roles(Role.ADMIN, Role.STAFF)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSlot(@Request() req: any, @Body() createSlotDto: CreateSlotDto) {
    const staffId = req.user.id;
    return this.appointmentsService.createSlot(staffId, createSlotDto);
  }
  @Post('book')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async bookAppointment(@Request() req: any, @Body() bookAppointmentDto: BookAppointmentDto) {
    const customerId = req.user.id;
    return this.appointmentsService.bookAppointment(customerId, bookAppointmentDto);
  }
  @Get('business/:businessId/available')
  @HttpCode(HttpStatus.OK)
  async findAvailableSlots(@Param('businessId') businessId: string) {
    return this.appointmentsService.findAvailableSlots(businessId);
  }
  @Post('waitlist/join')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async joinWaitlist(@Request() req: any, @Body() joinWaitlistDto: JoinWaitlistDto) {
    const customerId = req.user.id;
    return this.appointmentsService.joinWaitlist(customerId, joinWaitlistDto);
  }
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelAppointment(@Request() req: any, @Param('id') appointmentId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.cancelAppointment(customerId, appointmentId);
  }
  @Post('slots/:slotId/confirm-hold')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async confirmHold(@Request() req: any, @Param('slotId') slotId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.confirmHold(customerId, slotId);
  }
  @Post('slots/:slotId/decline-hold')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async declineHold(@Request() req: any, @Param('slotId') slotId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.declineHold(customerId, slotId);
  }
  @Post('slots/:slotId/leave-waitlist')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leaveWaitlist(@Request() req: any, @Param('slotId') slotId: string) {
    const customerId = req.user.id;
    return this.appointmentsService.leaveWaitlist(customerId, slotId);
  }
}



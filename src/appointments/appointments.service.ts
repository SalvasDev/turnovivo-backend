import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { BookAppointmentDto } from './dto/book-appointment.dto';
import { Appointment, AppointmentSlot, SlotStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client-runtime-utils';
import { JoinWaitlistDto } from './dto/join-waitlist.dto';
import { RedisService } from '../redis/redis.service';


@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService, private readonly redisService: RedisService) {}

  // 1. CREAR UN HUECO HORARIO (Generado por el Staff/Barbero)
  async createSlot(staffId: string, createSlotDto: CreateSlotDto): Promise<AppointmentSlot> {
    const { businessId, startTime, endTime } = createSlotDto;

    // Verificar si el negocio existe
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new NotFoundException('El negocio especificado no existe.');

    // Regla de Negocio: Validar que no se creen huecos con fechas en el pasado o invertidas
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

  // 2. AGENDAR UNA CITA TRADICIONAL (Ejecutado por el Cliente - Transaccional)
  async bookAppointment(customerId: string, bookAppointmentDto: BookAppointmentDto): Promise<Appointment> {
    const { slotId } = bookAppointmentDto;

    // Ejecutamos ambas operaciones dentro de una transacción aislada de Prisma
    return this.prisma.$transaction(async (tx) => {
      
      // A. Buscar el hueco y verificar que siga disponible
      const slot = await tx.appointmentSlot.findUnique({ where: { id: slotId } });
      if (!slot) throw new NotFoundException('El bloque de tiempo solicitado no existe.');

      if (slot.status !== SlotStatus.AVAILABLE) {
        throw new ConflictException('Este turno ya no se encuentra disponible.');
      }

      // B. Cambiar el estado del hueco a RESERVED
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.RESERVED },
      });

      try {
        // C. Crear la cita física ligada al cliente
        return await tx.appointment.create({
          data: {
            slotId,
            customerId,
            status: 'SCHEDULED',
          },
        });
      } catch (error) {
        // --- DEFENSA EN ENTREVISTAS (Captura del Unique Constraint de Prisma) ---
        // P2002 es el código de error oficial de Prisma para violaciones de restricciones únicas.
        // Si dos peticiones pasaron el "Check" del paso A en el mismo milisegundo, la base de datos
        // ejecutará las inserciones en la tabla appointments. La segunda rebotará aquí salvándonos del double-booking.
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Condición de carrera detectada: Este turno acaba de ser reservado por otro cliente.');
        }
        throw error;
      }
    });
  }

    // 3. OBTENER AGENDA COMPLETA (Sincronización Total: Holds de Redis + Lista de Espera de Postgres)
  async findAvailableSlots(businessId: string): Promise<any[]> {
    // 1. Jalamos los slots de la jornada laboral de mañana con sus relaciones base
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
          select: { customerId: true } // Lista de espera original de Postgres
        }
      },
      orderBy: { startTime: 'asc' },
    });

    // 2. --- BLINDAJE DE PERSISTENCIA SENIOR ---
    // Recorremos los slots. Si detectamos un HOLD, leemos Redis, pero MANTENEMOS
    // intacto el arreglo 'waitlistEntries' de Postgres para que el Frontend no pierda el pill al refrescar.
    return Promise.all(
      slots.map(async (slot) => {
        if (slot.status === 'HOLD') {
          const activeUserIdInRedis = await this.redisService.get(`hold:${slot.id}`);
          return {
            ...slot,
            // Inyectamos el dueño efímero de Redis en el objeto simulado
            appointment: activeUserIdInRedis ? { customerId: activeUserIdInRedis } : null,
            // 🚨 SOLUCIÓN: Forzamos a que viaje la lista de espera real en el JSON
            waitlistEntries: slot.waitlistEntries 
          };
        }
        return slot;
      })
    );
  }

  // ==========================================
  // 4. UNIRSE A LA LISTA DE ESPERA (Prioridad Incremental)
  // ==========================================
  async joinWaitlist(customerId: string, joinWaitlistDto: JoinWaitlistDto): Promise<any> {
    const { slotId } = joinWaitlistDto;

    // A. Verificar que el slot exista y NO esté disponible (si está libre, el cliente debe agendar, no esperar)
    const slot = await this.prisma.appointmentSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundException('El bloque de tiempo solicitado no existe.');
    if (slot.status === SlotStatus.AVAILABLE) {
      throw new ConflictException('Este turno está libre. Puedes agendarlo directamente sin hacer fila.');
    }

    // B. --- ALGORITMO DE PRIORIDAD SENIOR (Evita colisiones de ordenamiento) ---
    // Usamos una transacción para calcular la posición exacta de este usuario en la cola.
    // Contamos cuántas personas ya están formadas para este mismo slot y le sumamos 1.
    return this.prisma.$transaction(async (tx) => {
      const currentCount = await tx.waitlistEntry.count({
        where: { slotId },
      });

      const nextPriority = currentCount + 1;

      try {
        return await tx.waitlistEntry.create({
          data: {
            slotId,
            customerId,
            priority: nextPriority,
          },
        });
      } catch (error) {
        // Captura el @@unique([slotId, customerId]) definido en el Bloque 1
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('Ya te encuentras registrado en la lista de espera de este turno.');
        }
        throw error;
      }
    });
  }

  // ==========================================
  // 5. CANCELACIÓN RESILIENTE Y DISPARADOR DE HOLD (TurnoVivo Core)
  // ==========================================
  async cancelAppointment(customerId: string, appointmentId: string): Promise<any> {
    
    return this.prisma.$transaction(async (tx) => {
      // A. Validar que la cita exista y pertenezca al cliente que intenta cancelar
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        include: { slot: true }, // Traemos los datos del hueco asociado
      });

      if (!appointment) throw new NotFoundException('La cita especificada no existe.');

      // 1. EXTRAEMOS EL ROL DEL OPERADOR QUE LANZÓ LA PETICIÓN
      // Para que esto funcione, primero debemos asegurarnos de que el JwtStrategy 
      // inyecte el rol en el request (lo cual ya hace: id, email, role)
      const userRunningAction = await tx.user.findUnique({ where: { id: customerId } });
      const isStaffOrAdmin = userRunningAction?.role === 'STAFF' || userRunningAction?.role === 'ADMIN';
      
      // Regla de Negocio: Los clientes solo cancelan sus propias citas. Los ADMIN pueden saltarse esto en producción.
      if (appointment.customerId !== customerId && !isStaffOrAdmin) {
        throw new ForbiddenException('No tienes autorización para cancelar esta cita.');
      }

      if (appointment.status === 'CANCELLED') {
        throw new ConflictException('Esta cita ya ha sido cancelada previamente.');
      }

     // CORRECCIÓN ATÓMICA DE CONCURRENCIA:
      // En lugar de hacer un .update a CANCELLED, eliminamos físicamente el registro viejo.
      // Esto libera instantáneamente la restricción @unique del slotId en PostgreSQL,
      // permitiendo que el turno pueda ser reservado y cancelado infinitas veces sin chocar.
      await tx.appointment.delete({
        where: { id: appointmentId },
      });

      const slotId = appointment.slotId;

      // C. Consultar si hay personas esperando en la cola para este bloque de tiempo
      const firstInLine = await tx.waitlistEntry.findFirst({
        where: { slotId },
        orderBy: { priority: 'asc' }, // El primero que llegó tiene prioridad 1
      });

      // CASO ALTERNATIVO: Si nadie está esperando, el hueco vuelve a ser público para cualquiera
      if (!firstInLine) {
        await tx.appointmentSlot.update({
          where: { id: slotId },
          data: { status: SlotStatus.AVAILABLE },
        });
        return { message: 'Cita cancelada con éxito. El horario vuelve a estar disponible al público.' };
      }

      // CASO CORE: Hay clientes esperando. Activamos el protocolo de protección anti-no-show
      // Cambiamos el estado del hueco a HOLD (Nadie puede agendarlo desde la interfaz pública)
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.HOLD },
      });

      // --- CAPA DE INFRAESTRUCTURA (Disparar la mecha en Redis) ---
      // Guardamos en la memoria RAM una clave efímera vinculando el slot con el usuario elegido
      // Para pruebas rápidas en tu entorno local, usaremos un TTL de 30 segundos en lugar de 15 minutos ('EX', 30)
      const redisKey = `hold:${slotId}`;
      await this.redisService.set(redisKey, firstInLine.customerId, 'EX', 30);

      return {
        message: 'Cita cancelada con éxito. El espacio ha sido bloqueado en HOLD.',
        notifiedUserId: firstInLine.customerId,
        expiresInSeconds: 30,
      };
    });
  }

  // ==========================================
  // 6. CONFIRMAR TURNO EN HOLD (El cliente acepta el reto a tiempo)
  // ==========================================
  async confirmHold(customerId: string, slotId: string): Promise<Appointment> {
    const redisKey = `hold:${slotId}`;

    // A. Consultar en la RAM de Redis si el Hold sigue vivo y pertenece a este usuario
    const activeUserInHold = await this.redisService.get(redisKey);

    if (!activeUserInHold) {
      throw new ConflictException('El tiempo de reserva (Hold) ha expirado o el turno no está disponible.');
    }

    if (activeUserInHold !== customerId) {
      throw new ForbiddenException('No tienes autorización para confirmar este turno reservado.');
    }

    // B. El usuario respondió a tiempo. Ejecutamos la asignación de forma atómica
    return this.prisma.$transaction(async (tx) => {
      
      // 1. Destruimos la clave de Redis manualmente antes de que expire para detener la cascada
      await this.redisService.del(redisKey);

      // 2. Removemos al usuario de la lista de espera de este slot
      await tx.waitlistEntry.deleteMany({
        where: { slotId, customerId },
      });

      // 3. Cambiamos el estado del hueco de la agenda de HOLD a RESERVED de forma permanente
      await tx.appointmentSlot.update({
        where: { id: slotId },
        data: { status: SlotStatus.RESERVED },
      });

      // 4. Creamos la nueva cita oficial para este cliente
      return await tx.appointment.create({
        data: {
          slotId,
          customerId,
          status: 'SCHEDULED',
        },
      });
    });
  }

  // =======================================================
  // 7. SALIR DE LA LISTA DE ESPERA (Retiro Voluntario de la Fila)
  // =======================================================
  async leaveWaitlist(customerId: string, slotId: string): Promise<{ message: string }> {
    // Buscamos si el registro existe en Postgres
    const entry = await this.prisma.waitlistEntry.findFirst({
      where: { slotId, customerId },
    });

    if (!entry) {
      throw new NotFoundException('No te encuentras registrado en la lista de espera de este turno.');
    }

    // Lo eliminamos físicamente de la fila
    await this.prisma.waitlistEntry.delete({
      where: { id: entry.id },
    });

    return { message: 'Has salido de la lista de espera exitosamente.' };
  }
}
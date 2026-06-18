import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppointmentsService } from '../appointments/appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { SlotStatus } from '@prisma/client';
import 'dotenv/config';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private subscriberClient!: Redis;

  // Usamos forwardRef porque RedisSubscriberService llama a AppointmentsService y viceversa (Inyección Circular Controlada)
  constructor(
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // 1. Instanciamos el SEGUNDO cliente exclusivo de Redis para el modo escucha
    this.subscriberClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    });

    // 2. Nos suscribimos al canal nativo de eventos de expiración de la base de datos 0 de Redis
    // Este nombre de canal (__keyevent@0__:expired) es el estándar oficial de Redis
    const expiredChannel = '__keyevent@0__:expired';
    await this.subscriberClient.subscribe(expiredChannel);
    console.log(`📡 TurnoVivo Core: Escuchando eventos de expiración en el canal Pub/Sub`);

    // 3. Configuramos el escuchador de mensajes asíncronos corregido
    this.subscriberClient.on('message', async (channel, expiredKey) => {
      if (expiredKey.startsWith('hold:')) {
        
        // --- REPARACIÓN DE ARQUITECTURA ---
        // .split(':') devuelve ['hold', 'uuid']. Accedemos al índice [1] 
        // para extraer estrictamente el string puro del UUID del slot.
        const slotId = expiredKey.split(':')[1]; 
        
        console.log(`⏰ ¡TIEMPO AGOTADO! El Hold para el slot ${slotId} ha expirado en Redis.`);
        
        // Ejecutamos el algoritmo de cascada pasando el UUID correcto
        await this.processNextInWaitlist(slotId);
      }
    });
  }

  // ==========================================
  // ALGORITMO CORE: PROCESAMIENTO EN CASCADA AUTOMATIZADO
  // ==========================================
  private async processNextInWaitlist(slotId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // A. Buscar el primer registro de la lista de espera para este slot (el usuario lento que expiró)
        const expiredEntry = await tx.waitlistEntry.findFirst({
          where: { slotId },
          orderBy: { priority: 'asc' },
        });

        if (!expiredEntry) {
          // Si por alguna razón extraña ya no hay nadie, liberamos el slot al público general
          await tx.appointmentSlot.update({
            where: { id: slotId },
            data: { status: SlotStatus.AVAILABLE },
          });
          console.log(`♻️ Slot ${slotId} liberado al público general (Lista de espera vacía).`);
          return;
        }

        // B. Expulsamos al usuario lento eliminándolo de la lista de espera actual
        await tx.waitlistEntry.delete({
          where: { id: expiredEntry.id },
        });
        console.log(`❌ Usuario ${expiredEntry.customerId} removido de la fila por no confirmar a tiempo.`);

        // C. Consultamos si queda una SIGUIENTE persona en la lista de espera
        const nextInLine = await tx.waitlistEntry.findFirst({
          where: { slotId },
          orderBy: { priority: 'asc' }, // El que tenía prioridad 2 ahora pasa a ser el primero
        });

        if (!nextInLine) {
          // No queda nadie más esperando. El horario vuelve a estar disponible para cualquiera
          await tx.appointmentSlot.update({
            where: { id: slotId },
            data: { status: SlotStatus.AVAILABLE },
          });
          console.log(`♻️ Slot ${slotId} reabierto al público: No quedan más clientes en espera.`);
          return;
        }

        // D. CASO DE ÉXITO EN CASCADA: Hay un siguiente usuario en fila.
        // Mantenemos el slot en estado HOLD y reiniciamos la mecha en el Redis principal
        // Volvemos a inyectar una clave de 30 segundos ligada al ID del nuevo cliente elegido
        const redisClient = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD,
        });

        await redisClient.set(`hold:${slotId}`, nextInLine.customerId, 'EX', 30);
        redisClient.disconnect(); // Cerramos esta conexión temporal de escritura inmediata

        console.log(`📢 ¡CASCADA ACTIVADA! Turno ofrecido al usuario ${nextInLine.customerId}. Nueva cuenta regresiva de 30s iniciada.`);
      });
    } catch (error) {
      console.error('🚨 Error crítico procesando la cascada de lista de espera:', error);
    }
  }

  async onModuleDestroy() {
    // Apagamos el cliente de forma segura al detener el servidor
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      console.log('🛑 Suscriptor de Redis cerrado de forma segura');
    }
  }
}

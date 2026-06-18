import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppointmentsService } from '../appointments/appointments.service';
import 'dotenv/config';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private subscriberClient!: Redis;
  constructor(
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async onModuleInit() {
    this.subscriberClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    });
    const expiredChannel = '__keyevent@0__:expired';
    await this.subscriberClient.subscribe(expiredChannel);
    console.log(`📡 TurnoVivo Core: Escuchando eventos de expiración en el canal Pub/Sub`);
    this.subscriberClient.on('message', async (channel, expiredKey) => {
      if (expiredKey.startsWith('hold:')) {
        const slotId = expiredKey.split(':')[1]; 
        
        console.log(`⏰ ¡TIEMPO AGOTADO! El Hold para el slot ${slotId} ha expirado en Redis.`);
        await this.appointmentsService.handleHoldExpiration(slotId);
      }
    });
  }

  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      console.log('🛑 Suscriptor de Redis cerrado de forma segura');
    }
  }
}

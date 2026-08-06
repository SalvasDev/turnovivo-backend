import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppointmentsService } from '../appointments/appointments.service';
import 'dotenv/config';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private subscriberClient!: Redis;
  private readonly logger = new Logger(RedisSubscriberService.name);

  constructor(
    @Inject(forwardRef(() => AppointmentsService))
    private readonly appointmentsService: AppointmentsService,
  ) {}

  async onModuleInit() {
    const maxRetryAttempts = Number(process.env.REDIS_MAX_RETRY_ATTEMPTS ?? 8);
    const retryBaseDelayMs = Number(process.env.REDIS_RETRY_BASE_DELAY_MS ?? 300);

    // Support full REDIS_URL or parse REDIS_HOST if it's a URL
    const redisUrl = process.env.REDIS_URL;
    const rawHost = process.env.REDIS_HOST ?? '';
    const useTls = process.env.REDIS_TLS === 'true';

    const commonOptions: Record<string, unknown> = {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempts: number) => {
        if (attempts > maxRetryAttempts) {
          return null;
        }
        return Math.min(attempts * retryBaseDelayMs, 2000);
      },
    };

    if (useTls) {
      commonOptions.tls = {};
    }

    if (redisUrl) {
      this.subscriberClient = new Redis(redisUrl as string, commonOptions as any);
    } else if (rawHost && (rawHost.includes('://') || rawHost.startsWith('http'))) {
      try {
        const u = new URL(rawHost);
        const host = u.hostname;
        const port = u.port ? Number(u.port) : Number(process.env.REDIS_PORT) || 6379;
        const password = u.password || process.env.REDIS_PASSWORD || (u.username || undefined);
        this.subscriberClient = new Redis({ host, port, password, ...commonOptions } as any);
      } catch (e) {
        this.subscriberClient = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD,
          ...commonOptions,
        } as any);
      }
    } else {
      this.subscriberClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        ...commonOptions,
      } as any);
    }

    this.subscriberClient.on('error', (error) => {
      this.logger.error(`Error en cliente suscriptor de Redis: ${this.formatRedisError(error)}`);
    });

    this.subscriberClient.on('reconnecting', () => {
      this.logger.warn('Reconectando suscriptor de Redis...');
    });

    this.subscriberClient.on('end', () => {
      this.logger.error('Suscriptor de Redis agotó reintentos o fue cerrado.');
    });

    const expiredChannel = '__keyevent@0__:expired';
    try {
      await this.subscriberClient.connect();
      await this.subscriberClient.subscribe(expiredChannel);
      this.logger.log('TurnoVivo Core: Escuchando eventos de expiración en el canal Pub/Sub');
    } catch (error) {
      this.logger.error(`No se pudo inicializar el suscriptor Redis: ${this.formatRedisError(error)}`);
      this.logger.warn('Continuando sin suscriptor Redis. Las expiraciones se manejarán por polling o manualmente.');
      return;
    }

    this.subscriberClient.on('message', async (channel, expiredKey) => {
      if (expiredKey.startsWith('hold:')) {
        const slotId = expiredKey.split(':')[1]; 
        
        this.logger.warn(`TIEMPO AGOTADO: El Hold para el slot ${slotId} ha expirado en Redis.`);
        await this.appointmentsService.handleHoldExpiration(slotId);
      }
    });
  }

  async onModuleDestroy() {
    if (this.subscriberClient) {
      await this.subscriberClient.quit();
      this.logger.log('Suscriptor de Redis cerrado de forma segura');
    }
  }

  private formatRedisError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message?.trim()) return error.message;
      return error.name;
    }
    return String(error);
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import 'dotenv/config';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const maxRetryAttempts = Number(process.env.REDIS_MAX_RETRY_ATTEMPTS ?? 8);
    const retryBaseDelayMs = Number(process.env.REDIS_RETRY_BASE_DELAY_MS ?? 300);

    super({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempts) => {
        if (attempts > maxRetryAttempts) {
          return null;
        }
        return Math.min(attempts * retryBaseDelayMs, 2000);
      },
    });

    this.on('error', (error) => {
      this.logger.error(`Error de conexion con Redis: ${this.formatRedisError(error)}`);
    });

    this.on('reconnecting', () => {
      this.logger.warn('Reconectando cliente principal de Redis...');
    });

    this.on('end', () => {
      this.logger.error('Cliente principal de Redis agotó reintentos o fue cerrado.');
    });
  }

  async onModuleInit() {
    try {
      await this.connect();
      await this.ping();
      this.logger.log('Conexión exitosa a Redis en memoria RAM');
    } catch (error) {
      this.logger.error(`No se pudo inicializar Redis: ${this.formatRedisError(error)}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.quit();
    this.logger.log('Conexión de Redis cerrada de forma segura');
  }

  private formatRedisError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message?.trim()) return error.message;
      return error.name;
    }
    return String(error);
  }
}

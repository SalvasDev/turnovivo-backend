import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import 'dotenv/config';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    const maxRetryAttempts = Number(process.env.REDIS_MAX_RETRY_ATTEMPTS ?? 8);
    const retryBaseDelayMs = Number(process.env.REDIS_RETRY_BASE_DELAY_MS ?? 300);

    // Support full REDIS_URL or allow REDIS_HOST to contain a URL (Upstash)
    const redisUrl = process.env.REDIS_URL;
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
      super(redisUrl as string, commonOptions as any);
    } else {
      // If REDIS_HOST includes a protocol/URL, parse it
      let host = process.env.REDIS_HOST || 'localhost';
      let port = Number(process.env.REDIS_PORT) || 6379;
      let password = process.env.REDIS_PASSWORD;
      const rawHost = process.env.REDIS_HOST ?? '';
      if (rawHost && (rawHost.includes('://') || rawHost.startsWith('http'))) {
        try {
          const u = new URL(rawHost);
          host = u.hostname;
          if (u.port) port = Number(u.port);
          if (u.password) password = u.password;
          if (!password && u.username) password = u.username;
        } catch (e) {
          // ignore parsing issues and use env fallbacks
        }
      }

      super({
        host,
        port,
        password,
        ...commonOptions,
      } as any);
    }

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

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import 'dotenv/config';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
    });
  }

  async onModuleInit() {
    await this.ping();
    console.log('🚀 Conexión exitosa a Redis en memoria RAM');
  }

  async onModuleDestroy() {
    await this.quit();
    console.log('🛑 Conexión de Redis cerrada de forma segura');
  }
}

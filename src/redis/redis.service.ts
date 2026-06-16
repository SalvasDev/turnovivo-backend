import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import 'dotenv/config'; // <-- LA SOLUCIÓN: Fuerza a Node a leer el .env antes de inicializar Redis

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Inicializamos ioredis asegurando que las variables de entorno existan
    super({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD, // Ahora sí viajará la contraseña real de Docker
    });
  }

  async onModuleInit() {
    // Verificamos físicamente la conexión haciendo un PING seguro
    await this.ping();
    console.log('🚀 Conexión exitosa a Redis en memoria RAM');
  }

  async onModuleDestroy() {
    await this.quit();
    console.log('🛑 Conexión de Redis cerrada de forma segura');
  }
}

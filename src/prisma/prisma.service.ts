import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;
  
  constructor() {
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });

    this.pool = pool;
  }
  
  async onModuleInit() {
    await this.$connect();
    console.log('🔌 Conexión exitosa a PostgreSQL mediante Driver Adapter en Prisma 7');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    console.log('🛑 Conexión de PostgreSQL cerrada de forma segura');
  }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  
  constructor() {
    // 1. Creamos una piscina de conexiones (Pool) nativa de PostgreSQL usando tu .env
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL 
    });
    
    // 2. Creamos el adaptador oficial de Prisma 7
    const adapter = new PrismaPg(pool);

    // 3. Se lo pasamos de forma estricta al constructor superior
    super({ adapter });
  }
  
  async onModuleInit() {
    await this.$connect();
    console.log('🔌 Conexión exitosa a PostgreSQL mediante Driver Adapter en Prisma 7');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('🛑 Conexión de PostgreSQL cerrada de forma segura');
  }
}

import 'dotenv/config'; // Carga el archivo .env de Node.js de forma forzada
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // ESTÁNDAR PRISMA 7: El comando seed ahora vive aquí adentro
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    // Usamos el objeto de entorno nativo de Node.js
    url: process.env.DATABASE_URL, 
  },
});

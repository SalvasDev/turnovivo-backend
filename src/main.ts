import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CONFIGURACIÓN CORS SENIOR: Permite peticiones estrictamente desde el puerto de Next.js
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001', // Tu app de Next.js
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // Indispensable para permitir el envío de cookies/sesiones si escala el proyecto
  });

  // ACTIVACIÓN SENIOR: Filtra y valida todas las entradas HTTP automáticamente
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remueve propiedades del Body que no estén definidas en el DTO
      forbidNonWhitelisted: true, // Arroja un error si el cliente envía campos de más
      transform: true, // Transforma automáticamente los payloads a las clases DTO de TS
    }),
  );

  await app.listen(process.env.PORT || 3000);
  console.log(`🚀 Servidor de TurnoVivo corriendo en el puerto ${process.env.PORT || 3000}`);
}
bootstrap();

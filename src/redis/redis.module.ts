import { Module, Global, forwardRef } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisSubscriberService } from './redis-subscriber.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AppointmentsModule), // Resuelve la dependencia circular con las citas
  ],
  providers: [RedisService, RedisSubscriberService], // Agregamos el suscriptor a los proveedores
  exports: [RedisService, RedisSubscriberService],
})
export class RedisModule {}

import { Module, forwardRef } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { RedisModule } from '../redis/redis.module'; // Importa tu módulo de Redis
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    // Rompemos el ciclo del lado de citas permitiendo la carga en diferido
    forwardRef(() => RedisModule), 
    AuthModule, // <-- AGREGADO AQUÍ: Ahora el módulo de citas sabe cómo validar tokens JWT
  ],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
  exports: [AppointmentsService], // <-- INDISPENSABLE: Permite que RedisModule consuma este servicio
})
export class AppointmentsModule {}


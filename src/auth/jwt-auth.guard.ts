import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  // Inyectamos nuestro RedisService global para consultar la memoria RAM
  constructor(private readonly redisService: RedisService) {
    super();
  }

  // El método canActivate decide si la petición pasa (true) o rebota (false)
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Ejecuta la validación criptográfica tradicional de Passport-JWT
    const isJwtValid = (await super.canActivate(context)) as boolean;
    if (!isJwtValid) return false;

    // 2. Extrae el objeto Request HTTP para obtener al usuario que Passport ya validó
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Datos retornados por el método validate() de la estrategia

    // 3. --- EL FILTRO DE CONCURRENCIA Y SEGURIDAD REAL ---
    // Consultamos de forma asíncrona a Redis si la sesión de este ID de usuario está activa
    const sessionActive = await this.redisService.get(`session:${user.id}`);
    
    if (!sessionActive) {
      // Si la clave no existe en Redis, el token fue revocado o la sesión expiró
      throw new UnauthorizedException('La sesión ha sido revocada o ha expirado.');
    }

    return true; // La firma es válida Y la sesión está viva en Redis. Pasa con éxito.
  }
}

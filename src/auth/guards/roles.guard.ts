import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  // Inyectamos el Reflector de NestJS para poder leer los metadatos reflectivos
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Leemos los roles requeridos para este endpoint específico
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no tiene el decorador @Roles, significa que es público para cualquier usuario autenticado
    if (!requiredRoles) {
      return true;
    }

    // 2. Extraemos el usuario que nuestro JwtAuthGuard inyectó previamente en la petición
    const { user } = context.switchToHttp().getRequest();

    // 3. Verificamos si el rol del usuario coincide con al menos uno de los roles requeridos
    const hasRole = requiredRoles.some((role) => user?.role === role);

    if (!hasRole) {
      // Excepción nativa de NestJS: Envía automáticamente un HTTP status 403 Forbidden
      throw new ForbiddenException('No tienes permisos suficientes para acceder a este recurso.');
    }

    return true;
  }
}

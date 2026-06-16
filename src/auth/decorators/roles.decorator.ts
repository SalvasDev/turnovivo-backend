import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Importamos el Enum estricto autogenerado por Prisma

// Definimos la clave bajo la cual guardaremos los metadatos en la memoria reflectiva
export const ROLES_KEY = 'roles';

// El decorador acepta una lista de roles permitidos (ej: @Roles(Role.ADMIN, Role.STAFF))
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

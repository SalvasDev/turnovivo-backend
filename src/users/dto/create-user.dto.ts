// src/users/dto/create-user.dto.ts
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'El formato del correo electrónico es inválido.' })
  readonly email!: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  readonly passwordHash!: string; // El input del formulario viaja mapeado aquí

  @IsEnum(Role, { message: 'El rol especificado no es válido para el sistema.' })
  @IsOptional() // Al ser opcional, si el cliente no lo envía, el servicio le asignará CUSTOMER por defecto
  readonly role?: Role;
}
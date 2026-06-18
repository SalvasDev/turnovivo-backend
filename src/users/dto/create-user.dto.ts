import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsEmail({}, { message: 'El formato del correo electrónico es inválido.' })
  readonly email!: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres.' })
  readonly passwordHash!: string;

  @IsEnum(Role, { message: 'El rol especificado no es válido para el sistema.' })
  @IsOptional()
  readonly role?: Role;
}
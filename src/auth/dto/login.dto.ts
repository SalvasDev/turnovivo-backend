// src/auth/dto/login.dto.ts
export class LoginDto {
  readonly email!: string;
  readonly passwordHash!: string; // La contraseña que el usuario digita en el login
}

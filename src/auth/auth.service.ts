import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService, // Inyectamos nuestra conexión RAM
  ) {}

  // 1. VALIDAR CREDENCIALES Y GENERAR SESIÓN HÍBRIDA (JWT + REDIS)
  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const { email, passwordHash } = loginDto;

    // Buscar si el usuario existe en PostgreSQL
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      // Excepción nativa de NestJS: Envía automáticamente un HTTP status 401
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    // Comparar la contraseña en texto plano con el hash guardado en Postgres
    const isPasswordValid = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    // Definir la carga útil (Payload) que viajará dentro del JWT
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    // Generar el token criptográfico firmado
    const accessToken = this.jwtService.sign(payload);

    // --- LA CAPA SENIOR: Persistencia de Sesión en Redis ---
    // Guardamos una clave única en Redis para este usuario.
    // Usamos un TTL (Time-To-Live) de 24 horas (86400 segundos), alineado con el JWT.
    const redisKey = `session:${user.id}`;
    await this.redisService.set(redisKey, 'active', 'EX', 86400);

    return { accessToken };
  }

  // 2. LOGOUT EFECTIVO (Invalida el token al instante borrando la sesión de Redis)
  async logout(userId: string): Promise<{ message: string }> {
    const redisKey = `session:${userId}`;
    await this.redisService.del(redisKey);
    return { message: 'Sesión cerrada exitosamente en todos los dispositivos.' };
  }
}

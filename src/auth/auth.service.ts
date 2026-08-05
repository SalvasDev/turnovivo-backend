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
    private readonly redisService: RedisService,
  ) {}
  async login(loginDto: LoginDto): Promise<{ accessToken: string }> {
    const { email, passwordHash } = loginDto;
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    const isPasswordValid = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);
    const redisKey = `session:${user.id}`;
    await this.redisService.set(redisKey, 'active', 'EX', 86400);

    return { accessToken };
  }

  async logout(userId: string): Promise<{ message: string }> {
    const redisKey = `session:${userId}`;
    await this.redisService.del(redisKey);
    return { message: 'Sesión cerrada exitosamente en todos los dispositivos' };
  }
}
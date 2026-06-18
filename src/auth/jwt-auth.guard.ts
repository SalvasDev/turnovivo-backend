import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly redisService: RedisService) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isJwtValid = (await super.canActivate(context)) as boolean;
    if (!isJwtValid) return false;
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const sessionActive = await this.redisService.get(`session:${user.id}`);
    
    if (!sessionActive) {
      throw new UnauthorizedException('La sesión ha sido revocada o ha expirado.');
    }

    return true;
  }
}

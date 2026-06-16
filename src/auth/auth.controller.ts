import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // --- EL ENDPOINT DE LOGOUT SEGURO ---
  @Post('logout')
  @UseGuards(JwtAuthGuard) // Protegemos la ruta: el usuario debe enviar un JWT válido para poder cerrar sesión
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any) {
    // req.user fue inyectado de forma segura por el JwtAuthGuard tras verificar el token e ioredis
    const userId = req.user.id;
    return this.authService.logout(userId);
  }
}
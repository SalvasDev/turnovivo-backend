import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }), // Forzamos la estrategia por defecto
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { 
        // Aplicamos "as any" para indicarle a TypeScript que confíe en el string de entorno
        expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any 
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, PassportModule, JwtStrategy], // <-- MODIFICADO: Exportamos Passport y la estrategia
})
export class AuthModule {}

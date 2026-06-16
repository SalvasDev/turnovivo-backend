import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import 'dotenv/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    // Configuración base obligatoria de Passport-JWT
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // Extrae "Bearer <TOKEN>"
      ignoreExpiration: false, // Bloquea automáticamente si el token ya expiró por tiempo
      secretOrKey: process.env.JWT_SECRET || 'fallback_secret', // Llave de verificación
    });
  }

  // Si el token es válido criptográficamente, Passport ejecuta automáticamente este método
  async validate(payload: { sub: string; email: string; role: string }) {
    // Retorna los datos limpios que se inyectarán dentro del objeto Request de HTTP (req.user)
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
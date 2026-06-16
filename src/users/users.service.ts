import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  // Inyección de Dependencias: NestJS pasa automáticamente el PrismaService único aquí
  constructor(private readonly prisma: PrismaService) {}

   // 1. Crear un usuario en la base de datos aplicando Hashing a la contraseña
  async create(data: Prisma.UserCreateInput): Promise<Omit<User, 'passwordHash'>> {
    // Verificar si el correo ya está registrado en el sistema
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado.');
    }

    // --- TEORÍA DE SEGURIDAD (Bcrypt Hashing) ---
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.passwordHash, salt);

    // Guardamos en la base de datos real mapeando el campo correspondiente
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        role: data.role,
        passwordHash: hashedPassword, // Asignamos el valor encriptado al campo correcto
      },
    });

    // Remover el hash del objeto antes de retornar para cumplir con la promesa Omit<User, 'passwordHash'>
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // 2. Buscar un usuario por email (Utilidad interna esencial para el Login)
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  // 3. Buscar un usuario por ID
  async findById(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) return null;

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

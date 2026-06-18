// src/users/users.controller.ts
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users') // Abre la ruta base: http://localhost:3000/users
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post() // Ruta: POST /users
  @HttpCode(HttpStatus.CREATED) // Retorna un HTTP 201 estandarizado internacionalmente
  async create(@Body() createUserDto: CreateUserDto) {
    // El ValidationPipe intercepta el Body y lo valida contra el CreateUserDto
    return this.usersService.create(createUserDto);
  }
}

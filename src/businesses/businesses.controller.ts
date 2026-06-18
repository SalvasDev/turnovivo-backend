import { Controller, Post, Get, Body, Param, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('businesses') // Ruta base: /businesses
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  // ENDPOINT 1: Crear Negocio (Protegido con JWT e hilo de roles RBAC)
  @Post()
  @Roles(Role.ADMIN) // Solo los administradores pueden registrar un nuevo negocio
  @UseGuards(JwtAuthGuard, RolesGuard) // Se ejecutan secuencialmente en este orden estricto
  @HttpCode(HttpStatus.CREATED) // Retorna un HTTP 201 estandarizado
  async create(@Body() createBusinessDto: CreateBusinessDto) {
    return this.businessesService.create(createBusinessDto);
  }

  // ENDPOINT 2: Obtener Negocio por Slug (Público para clientes en Next.js)
  @Get(':slug') // Ruta: GET /businesses/barberia-premium
  @HttpCode(HttpStatus.OK) // Retorna un HTTP 200 estandarizado
  async findBySlug(@Param('slug') slug: string) {
    return this.businessesService.findBySlug(slug);
  }
}

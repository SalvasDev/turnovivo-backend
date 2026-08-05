import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { Business } from '@prisma/client';

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}
  
  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    const { name, slug } = createBusinessDto;
    const existingBusiness = await this.prisma.business.findUnique({
      where: { slug },
    });

    if (existingBusiness) {
      throw new ConflictException('Ya existe un negocio registrado con ese mismo slug.');
    }

    return this.prisma.business.create({
      data: { name, slug },
    });
  }
  async findBySlug(slug: string): Promise<Business> {
    const business = await this.prisma.business.findUnique({
      where: { slug },
    });

    if (!business) {
      throw new NotFoundException(`El negocio con el slug "${slug}" no fue encontrado.`);
    }

    return business;
  }
}
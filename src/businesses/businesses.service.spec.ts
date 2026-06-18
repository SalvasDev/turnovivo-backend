import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessesService } from './businesses.service';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      business: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    service = new BusinessesService(prisma);
  });

  it('debe lanzar Conflict si el slug ya existe', async () => {
    prisma.business.findUnique.mockResolvedValue({ id: 'biz-1', slug: 'barberia-premium' });

    await expect(
      service.create({ name: 'Barberia X', slug: 'barberia-premium' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe crear negocio cuando el slug no existe', async () => {
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.business.create.mockResolvedValue({ id: 'biz-2', name: 'Barberia Y', slug: 'barberia-y' });

    const result = await service.create({ name: 'Barberia Y', slug: 'barberia-y' });

    expect(prisma.business.create).toHaveBeenCalledWith({ data: { name: 'Barberia Y', slug: 'barberia-y' } });
    expect(result.slug).toBe('barberia-y');
  });

  it('debe lanzar NotFound en findBySlug cuando no existe', async () => {
    prisma.business.findUnique.mockResolvedValue(null);

    await expect(service.findBySlug('inexistente')).rejects.toBeInstanceOf(NotFoundException);
  });
});

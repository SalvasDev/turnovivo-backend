import { Test, TestingModule } from '@nestjs/testing';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

describe('BusinessesController', () => {
  let controller: BusinessesController;
  let service: { create: jest.Mock; findBySlug: jest.Mock };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findBySlug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BusinessesController],
      providers: [{ provide: BusinessesService, useValue: service }],
    }).compile();

    controller = module.get<BusinessesController>(BusinessesController);
  });

  it('debe delegar create al servicio', async () => {
    const dto = { name: 'Barberia Premium', slug: 'barberia-premium' };
    service.create.mockResolvedValue({ id: 'biz-1', ...dto });

    const result = await controller.create(dto as any);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('biz-1');
  });

  it('debe delegar findBySlug al servicio', async () => {
    service.findBySlug.mockResolvedValue({ id: 'biz-1', slug: 'barberia-premium' });

    const result = await controller.findBySlug('barberia-premium');

    expect(service.findBySlug).toHaveBeenCalledWith('barberia-premium');
    expect(result.slug).toBe('barberia-premium');
  });
});

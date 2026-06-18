import { ConflictException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    service = new UsersService(prisma);
  });

  it('debe lanzar Conflict si el email ya existe', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'dup@test.com' });

    await expect(
      service.create({ email: 'dup@test.com', passwordHash: '123456', role: 'CUSTOMER' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('debe crear usuario hasheando password y sin retornarla', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u-10',
      email: 'ok@test.com',
      role: 'CUSTOMER',
      passwordHash: 'hashed-value',
    });

    const result = await service.create({
      email: 'ok@test.com',
      passwordHash: 'plain-password',
      role: 'CUSTOMER',
    } as any);

    expect(prisma.user.create).toHaveBeenCalled();
    const createArg = prisma.user.create.mock.calls[0][0];
    expect(createArg.data.passwordHash).not.toBe('plain-password');
    expect(result).toEqual({ id: 'u-10', email: 'ok@test.com', role: 'CUSTOMER' });
  });

  it('findById debe retornar null si no existe y ocultar hash si existe', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.findById('missing')).resolves.toBeNull();

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u-20',
      email: 'safe@test.com',
      role: 'CUSTOMER',
      passwordHash: 'secret',
    });

    await expect(service.findById('u-20')).resolves.toEqual({
      id: 'u-20',
      email: 'safe@test.com',
      role: 'CUSTOMER',
    });
  });
});

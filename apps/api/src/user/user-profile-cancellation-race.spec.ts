import { NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService profile cancellation race', () => {
  it('fails the profile write when cancellation wins after the initial existence check', async () => {
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValueOnce({ id: 7n, deletedAt: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    } as any;
    const service = new UserService(prisma);

    await expect(service.updateProfile('7', { nickname: 'late-write' }))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 7n, deletedAt: null },
      data: { nickname: 'late-write' },
    });
  });
});

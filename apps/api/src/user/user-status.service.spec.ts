import { jest } from '@jest/globals';
import { UserStatusService } from './user-status.service';

describe('UserStatusService', () => {
  it('sets the requested state once and treats the same retry as a no-op', async () => {
    let status = 1;
    const redis = {
      delByPattern: jest.fn(async () => 2),
      del: jest.fn(async () => 1),
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n, status }]),
      user: {
        update: jest.fn(async ({ data }: any) => {
          status = data.status;
          return { id: 7n, status };
        }),
      },
    };
    tx.$queryRaw.mockImplementation(async () => [{ id: 7n, status }]);
    const transaction = jest.fn(async (callback: any) => callback(tx));
    const service = new UserStatusService({ $transaction: transaction } as any, redis as any);

    await expect(service.setStatus('7', 0)).resolves.toEqual({ id: '7', status: 0 });
    expect(status).toBe(0);
    expect(redis.delByPattern).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);

    await expect(service.setStatus('7', 0)).resolves.toEqual({ id: '7', status: 0 });
    expect(status).toBe(0);
    expect(redis.delByPattern).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledTimes(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
  });

  it('revokes sessions again before an explicit re-enable transition', async () => {
    let status = 0;
    const redis = {
      delByPattern: jest.fn(async () => 1),
      del: jest.fn(async () => 1),
    };
    const tx = {
      $queryRaw: jest.fn(async () => [{ id: 7n, status }]),
      user: {
        update: jest.fn(async ({ data }: any) => {
          status = data.status;
          return { id: 7n, status };
        }),
      },
    };
    tx.$queryRaw.mockImplementation(async () => [{ id: 7n, status }]);
    const service = new UserStatusService(
      { $transaction: jest.fn(async (callback: any) => callback(tx)) } as any,
      redis as any,
    );

    await expect(service.setStatus('7', 1)).resolves.toEqual({ id: '7', status: 1 });
    expect(redis.delByPattern).toHaveBeenCalledWith('weapp_access_token:7:*');
    expect(redis.del).toHaveBeenCalledWith('wechat_session:7');
    expect(status).toBe(1);
  });
});

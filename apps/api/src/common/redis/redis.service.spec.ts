import { RedisService } from './redis.service';

describe('RedisService.delByPattern', () => {
  it('uses incremental SCAN pages and deletes only matched keys', async () => {
    const client: any = {
      scan: jest
        .fn()
        .mockResolvedValueOnce(['17', ['admin_refresh_token:7:a', 'admin_refresh_token:7:b']])
        .mockResolvedValueOnce(['0', ['admin_refresh_token:7:c']]),
      del: jest
        .fn()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1),
    };
    const service = new RedisService(client);

    const deleted = await service.delByPattern('admin_refresh_token:7:*', 100);

    expect(deleted).toBe(3);
    expect(client.scan).toHaveBeenNthCalledWith(
      1,
      '0',
      'MATCH',
      'admin_refresh_token:7:*',
      'COUNT',
      100,
    );
    expect(client.scan).toHaveBeenNthCalledWith(
      2,
      '17',
      'MATCH',
      'admin_refresh_token:7:*',
      'COUNT',
      100,
    );
    expect(client.del).toHaveBeenNthCalledWith(
      1,
      'admin_refresh_token:7:a',
      'admin_refresh_token:7:b',
    );
    expect(client.del).toHaveBeenNthCalledWith(
      2,
      'admin_refresh_token:7:c',
    );
  });
});

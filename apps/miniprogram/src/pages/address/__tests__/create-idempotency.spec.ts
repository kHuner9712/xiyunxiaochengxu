import { beforeEach, describe, expect, it, vi } from 'vitest';
import { post } from '@/utils/request';
import { createAddress } from '@/api/address';

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('收货地址新增弱网幂等', () => {
  const storage = new Map<string, unknown>();

  beforeEach(() => {
    vi.clearAllMocks();
    storage.clear();
    ;(globalThis as any).uni = {
      getStorageSync: vi.fn((key: string) => storage.get(key) ?? ''),
      setStorageSync: vi.fn((key: string, value: unknown) => storage.set(key, value)),
      removeStorageSync: vi.fn((key: string) => storage.delete(key)),
    };
  });

  it('response loss retries the same create with the same clientRequestId', async () => {
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce({ id: '20' } as any);

    const payload = {
      name: '李四',
      phone: '13900139000',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国门外大街1号',
      isDefault: false,
    };

    await expect(createAddress(payload)).rejects.toThrow('network response lost');
    const firstBody = vi.mocked(post).mock.calls[0]?.[1] as any;
    expect(firstBody.clientRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i);
    expect(storage.size).toBe(1);

    await expect(createAddress(payload)).resolves.toEqual({ id: '20' });
    const secondBody = vi.mocked(post).mock.calls[1]?.[1] as any;

    expect(secondBody.clientRequestId).toBe(firstBody.clientRequestId);
    expect(vi.mocked(post)).toHaveBeenCalledTimes(2);
    expect(storage.size).toBe(0);
  });
});

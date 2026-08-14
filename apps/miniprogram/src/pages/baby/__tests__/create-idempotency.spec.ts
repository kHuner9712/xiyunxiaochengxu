import { beforeEach, describe, expect, it, vi } from 'vitest';
import { post } from '@/utils/request';
import { createBaby } from '@/api/baby';

vi.mock('@/utils/request', () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));

describe('宝宝档案新增弱网幂等', () => {
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

  it('response loss retries the same logical create with the same clientRequestId', async () => {
    vi.mocked(post)
      .mockRejectedValueOnce(new Error('network response lost'))
      .mockResolvedValueOnce({ id: '8' } as any);

    const payload = {
      nickname: '小宝',
      gender: 1,
      birthday: '2025-01-01',
      avatarUrl: '/uploads/public/baby.png',
    };

    await expect(createBaby(payload)).rejects.toThrow('network response lost');
    const firstBody = vi.mocked(post).mock.calls[0]?.[1] as any;
    expect(firstBody.clientRequestId).toMatch(/^\d{13}-[a-z0-9]{16,40}$/i);
    expect(storage.size).toBe(1);

    await expect(createBaby(payload)).resolves.toEqual({ id: '8' });
    const secondBody = vi.mocked(post).mock.calls[1]?.[1] as any;

    expect(secondBody.clientRequestId).toBe(firstBody.clientRequestId);
    expect(vi.mocked(post)).toHaveBeenCalledTimes(2);
    expect(storage.size).toBe(0);
  });
});

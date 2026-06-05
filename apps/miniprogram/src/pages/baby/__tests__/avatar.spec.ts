import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BabyEditPage from '../edit.vue';
import BabyListPage from '../list.vue';
import { chooseAndUploadImage } from '@/api/upload';
import { createBaby, getBabyDetail, getBabyList, updateBaby } from '@/api/baby';

const uniAppMock = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, any>) => void | Promise<void>>,
  onShowCallbacks: [] as Array<() => void | Promise<void>>,
}));

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, any>) => void | Promise<void>) => {
    uniAppMock.onLoadCallbacks.push(callback);
  }),
  onShow: vi.fn((callback: () => void | Promise<void>) => {
    uniAppMock.onShowCallbacks.push(callback);
  }),
}));

vi.mock('@/api/upload', () => ({
  chooseAndUploadImage: vi.fn(),
}));

vi.mock('@/api/baby', () => ({
  getBabyDetail: vi.fn(),
  getBabyList: vi.fn(),
  createBaby: vi.fn(),
  updateBaby: vi.fn(),
  deleteBaby: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  uniAppMock.onLoadCallbacks = [];
  uniAppMock.onShowCallbacks = [];
  vi.mocked(chooseAndUploadImage).mockResolvedValue([{ url: 'https://example.com/baby-upload.png' }] as any);
  vi.mocked(createBaby).mockResolvedValue({} as any);
  vi.mocked(updateBaby).mockResolvedValue({} as any);
  vi.mocked(getBabyDetail).mockResolvedValue({
    id: '7',
    nickname: '小宝',
    gender: 1,
    birthday: '2025-01-01',
    avatarUrl: 'https://example.com/old-baby.png',
  } as any);
  vi.mocked(getBabyList).mockResolvedValue([]);
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    showModal: vi.fn(),
  };
});

describe('宝宝档案头像', () => {
  it('新增宝宝上传头像后提交 avatarUrl', async () => {
    const wrapper = mount(BabyEditPage);
    const vm = wrapper.vm as any;
    vm.form.nickname = '小宝';
    vm.form.gender = 1;
    vm.form.birthday = '2025-01-01';

    await vm.uploadAvatar();
    await vm.handleSubmit();
    await flushPromises();

    expect(createBaby).toHaveBeenCalledWith(expect.objectContaining({
      avatarUrl: 'https://example.com/baby-upload.png',
    }));
  });

  it('编辑宝宝头像后提交新的 avatarUrl', async () => {
    const wrapper = mount(BabyEditPage);
    await uniAppMock.onLoadCallbacks.at(-1)?.({ id: '7' });
    await flushPromises();

    const vm = wrapper.vm as any;
    await vm.uploadAvatar();
    await vm.handleSubmit();
    await flushPromises();

    expect(updateBaby).toHaveBeenCalledWith(expect.objectContaining({
      id: '7',
      avatarUrl: 'https://example.com/baby-upload.png',
    }));
  });

  it('列表页使用 avatarUrl 作为头像兜底显示', async () => {
    vi.mocked(getBabyList).mockResolvedValueOnce([{
      id: '7',
      nickname: '小宝',
      gender: 1,
      birthday: '2025-01-01',
      avatarUrl: 'https://example.com/list-baby.png',
    }] as any);

    const wrapper = mount(BabyListPage, {
      global: {
        stubs: {
          Empty: true,
        },
      },
    });
    await uniAppMock.onShowCallbacks.at(-1)?.();
    await flushPromises();

    expect(wrapper.find('image.baby-avatar').attributes('src')).toBe('https://example.com/list-baby.png');
  });
});

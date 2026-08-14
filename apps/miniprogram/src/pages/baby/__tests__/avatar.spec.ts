import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BabyEditPage from '../edit.vue';
import BabyListPage from '../list.vue';
import { chooseAndUploadImage } from '@/api/upload';
import { createBaby, deleteBaby as deleteBabyApi, getBabyDetail, getBabyList, updateBaby } from '@/api/baby';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  uniAppMock.onLoadCallbacks = [];
  uniAppMock.onShowCallbacks = [];
  vi.mocked(chooseAndUploadImage).mockResolvedValue([{ url: 'https://example.com/baby-upload.png' }] as any);
  vi.mocked(createBaby).mockResolvedValue({} as any);
  vi.mocked(updateBaby).mockResolvedValue({} as any);
  vi.mocked(deleteBabyApi).mockResolvedValue({} as any);
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

  it('头像仍在上传时禁止保存，避免提交旧头像或空头像', async () => {
    const pendingUpload = deferred<any[]>();
    vi.mocked(chooseAndUploadImage).mockImplementationOnce(() => pendingUpload.promise as any);
    const wrapper = mount(BabyEditPage);
    const vm = wrapper.vm as any;
    vm.form.nickname = '小宝';
    vm.form.birthday = '2025-01-01';

    const uploadTask = vm.uploadAvatar();
    expect(vm.uploading).toBe(true);

    await vm.handleSubmit();

    expect(createBaby).not.toHaveBeenCalled();
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '头像仍在上传，请稍后保存',
      icon: 'none',
    });

    pendingUpload.resolve([{ url: 'https://example.com/new-baby.png' }]);
    await uploadTask;
    expect(vm.uploading).toBe(false);
    expect(vm.form.avatarUrl).toBe('https://example.com/new-baby.png');
  });

  it('首个保存请求未完成时重复保存只发送一次写请求', async () => {
    const pendingSave = deferred<any>();
    vi.mocked(createBaby).mockImplementationOnce(() => pendingSave.promise);
    const wrapper = mount(BabyEditPage);
    const vm = wrapper.vm as any;
    vm.form.nickname = '小宝';
    vm.form.birthday = '2025-01-01';

    const first = vm.handleSubmit();
    const second = vm.handleSubmit();

    expect(vm.submitting).toBe(true);
    expect(createBaby).toHaveBeenCalledTimes(1);

    pendingSave.resolve({});
    await Promise.all([first, second]);

    expect(createBaby).toHaveBeenCalledTimes(1);
    expect(vm.submitting).toBe(false);
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

  it('删除确认框打开期间重复删除只打开一个确认并只写一次', async () => {
    vi.mocked(getBabyList)
      .mockResolvedValueOnce([{
        id: '7',
        nickname: '小宝',
        gender: 1,
        birthday: '2025-01-01',
      }] as any)
      .mockResolvedValueOnce([]);
    let modalOptions: any;
    ;(globalThis as any).uni.showModal = vi.fn((options: any) => {
      modalOptions = options;
    });

    const wrapper = mount(BabyListPage, {
      global: {
        stubs: {
          Empty: true,
        },
      },
    });
    await uniAppMock.onShowCallbacks.at(-1)?.();
    await flushPromises();

    const vm = wrapper.vm as any;
    const first = vm.deleteBaby(vm.babies[0]);
    const second = vm.deleteBaby(vm.babies[0]);

    expect(vm.actionBusy).toBe(true);
    expect((globalThis as any).uni.showModal).toHaveBeenCalledTimes(1);
    expect(deleteBabyApi).not.toHaveBeenCalled();

    modalOptions.success?.({ confirm: true });
    await Promise.all([first, second]);
    await flushPromises();

    expect(deleteBabyApi).toHaveBeenCalledTimes(1);
    expect(deleteBabyApi).toHaveBeenCalledWith('7');
    expect(vm.actionBusy).toBe(false);
  });
});

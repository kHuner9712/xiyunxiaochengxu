import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentListPage from '../list.vue';
import { getContentCategories, getContentList } from '@/api/content';

vi.mock('@dcloudio/uni-app', () => ({
  onReachBottom: vi.fn(),
  onPullDownRefresh: vi.fn(),
}));

vi.mock('@/api/content', () => ({
  getContentCategories: vi.fn(),
  getContentList: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getContentCategories).mockResolvedValue([
    { id: '10', name: '喂养' },
    { id: '20', name: '睡眠' },
  ]);
  vi.mocked(getContentList).mockResolvedValue({
    total: 1,
    list: [{
      id: '1',
      title: '辅食指南',
      coverImage: '',
      summary: '摘要',
      categoryId: '10',
      categoryName: '喂养',
      contentType: 'article',
      viewCount: 7,
      publishedAt: '2026-06-06',
    }],
  } as any);
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  };
});

describe('内容分类列表', () => {
  it('使用字符串分类 ID 请求并展示 categoryName', async () => {
    const wrapper = mount(ContentListPage, {
      global: {
        stubs: {
          Loading: true,
          Empty: true,
        },
      },
    });
    await flushPromises();

    expect(getContentList).toHaveBeenCalledWith(expect.objectContaining({ categoryId: '10' }));
    expect(wrapper.text()).toContain('喂养');
    expect(wrapper.text()).not.toContain('10');

    await wrapper.findAll('.tab-item')[1].trigger('tap');
    await flushPromises();

    expect(getContentList).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: '20' }));
  });
});

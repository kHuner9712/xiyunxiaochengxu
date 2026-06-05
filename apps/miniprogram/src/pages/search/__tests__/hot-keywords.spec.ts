import { flushPromises, mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchPage from '../index.vue';
import { getHotKeywords, getSearchHistory, searchProducts } from '@/api/search';

vi.mock('@/api/search', () => ({
  searchProducts: vi.fn(),
  getHotKeywords: vi.fn(),
  getSearchHistory: vi.fn(),
  clearSearchHistory: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getHotKeywords).mockResolvedValue(['奶粉', '纸尿裤']);
  vi.mocked(getSearchHistory).mockResolvedValue([]);
  vi.mocked(searchProducts).mockResolvedValue({ list: [], total: 0 });
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
  };
});

describe('搜索热门词', () => {
  it('显示字符串热门词并点击触发搜索', async () => {
    const wrapper = mount(SearchPage, {
      global: {
        stubs: {
          ProductCard: true,
          Loading: true,
          Empty: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('奶粉');
    expect(wrapper.text()).not.toContain('[object Object]');

    await wrapper.find('.keyword-tag').trigger('tap');
    await flushPromises();

    expect(searchProducts).toHaveBeenCalledWith({
      keyword: '奶粉',
      page: 1,
      pageSize: 10,
    });
  });
});

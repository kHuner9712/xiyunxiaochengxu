import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchPage from '../index.vue';
import { clearSearchHistory, getHotKeywords, getSearchHistory, searchProducts } from '@/api/search';

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: false,
  },
}));

vi.mock('@/api/search', () => ({
  searchProducts: vi.fn(),
  getHotKeywords: vi.fn(),
  getSearchHistory: vi.fn(),
  clearSearchHistory: vi.fn(),
}));

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}));

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.userStore.isLoggedIn = false;
  vi.mocked(getHotKeywords).mockResolvedValue(['奶粉', '纸尿裤']);
  vi.mocked(getSearchHistory).mockResolvedValue([]);
  vi.mocked(searchProducts).mockResolvedValue({ list: [], total: 0 });
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(),
    switchTab: vi.fn(),
  };
});

describe('搜索热门词', () => {
  function mountSearchPage() {
    return mount(SearchPage, {
      global: {
        stubs: {
          ProductCard: true,
          Loading: true,
          Empty: true,
        },
      },
    });
  }

  it('未登录进入搜索页不会加载历史或跳登录，仍会加载热门搜索', async () => {
    const wrapper = mountSearchPage();
    await flushPromises();

    expect(getHotKeywords).toHaveBeenCalled();
    expect(getSearchHistory).not.toHaveBeenCalled();
    expect((globalThis as any).uni.switchTab).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('奶粉');
  });

  it('未登录可以点击热门词触发搜索', async () => {
    const wrapper = mountSearchPage();
    await flushPromises();

    await wrapper.find('.keyword-tag').trigger('tap');
    await flushPromises();

    expect(searchProducts).toHaveBeenCalledWith({
      keyword: '奶粉',
      page: 1,
      pageSize: 10,
    });
    expect(getSearchHistory).not.toHaveBeenCalled();
  });

  it('未登录可以手动搜索商品', async () => {
    const wrapper = mountSearchPage();
    await flushPromises();

    await wrapper.find('.search-input').setValue('湿巾');
    await wrapper.find('.search-btn').trigger('tap');
    await flushPromises();

    expect(searchProducts).toHaveBeenCalledWith({
      keyword: '湿巾',
      page: 1,
      pageSize: 10,
    });
    expect((globalThis as any).uni.switchTab).not.toHaveBeenCalled();
  });

  it('未登录清空历史不请求接口', async () => {
    const wrapper = mountSearchPage();
    await flushPromises();

    (wrapper.vm as any).searchHistory = ['奶粉'];
    await nextTick();
    await wrapper.find('.clear-btn').trigger('tap');

    expect(clearSearchHistory).not.toHaveBeenCalled();
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '登录后可管理搜索历史',
      icon: 'none',
    });
  });

  it('已登录可以加载并清空搜索历史', async () => {
    storeMock.userStore.isLoggedIn = true;
    vi.mocked(getSearchHistory).mockResolvedValue(['奶粉']);

    const wrapper = mountSearchPage();
    await flushPromises();

    expect(getSearchHistory).toHaveBeenCalled();
    expect(wrapper.text()).toContain('搜索历史');

    await wrapper.find('.clear-btn').trigger('tap');
    await flushPromises();

    expect(clearSearchHistory).toHaveBeenCalled();
  });

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

import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductDetailPage from '../detail.vue'
import { getProductDetail, getProductRecommend } from '@/api/product'

const lifecycle = vi.hoisted(() => ({
  onLoadCallbacks: [] as Array<(options?: Record<string, string>) => void>,
}))
const cartState = vi.hoisted(() => ({
  addToCart: vi.fn(),
}))
const userState = vi.hoisted(() => ({
  isLoggedIn: true,
  userInfo: { id: 'user-1' } as any,
  requireLogin: vi.fn((callback: () => unknown) => callback()),
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn((callback: (options?: Record<string, string>) => void) => lifecycle.onLoadCallbacks.push(callback)),
  onShareAppMessage: vi.fn(),
}))

vi.mock('@/api/product', () => ({
  getProductDetail: vi.fn(),
  getProductRecommend: vi.fn(),
}))

vi.mock('@/stores/cart', () => ({
  useCartStore: () => cartState,
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => userState,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function sellableProduct() {
  return {
    id: 'product-1',
    name: '测试纸尿裤',
    subtitle: '',
    images: ['https://example.test/product.png'],
    videoUrl: '',
    price: 9900,
    originalPrice: 10900,
    sales: 20,
    stock: 10,
    status: 1,
    description: '<p>详情</p>',
    tags: [],
    specs: [],
    skus: [
      {
        id: 'sku-1',
        productId: 'product-1',
        specText: 'M码',
        price: 9900,
        stock: 10,
        image: '',
      },
    ],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  lifecycle.onLoadCallbacks = []
  cartState.addToCart = vi.fn().mockResolvedValue(undefined)
  userState.isLoggedIn = true
  userState.userInfo = { id: 'user-1' }
  userState.requireLogin = vi.fn((callback: () => unknown) => callback())
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    navigateTo: vi.fn(({ success }) => success?.()),
    switchTab: vi.fn(),
    previewImage: vi.fn(),
  }
  vi.mocked(getProductRecommend).mockResolvedValue({ list: [], total: 0 } as any)
})

describe('商品详情购买动作', () => {
  it('加入购物车会使用当前可售 SKU，并等待成功后再提示用户', async () => {
    vi.mocked(getProductDetail).mockResolvedValue(sellableProduct() as any)
    const wrapper = shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()

    ;(wrapper.vm as any).handleAddCart()
    await (wrapper.vm as any).confirmSku()
    await flushPromises()

    expect(userState.requireLogin).not.toHaveBeenCalled()
    expect(cartState.addToCart).toHaveBeenCalledWith({
      productId: 'product-1',
      skuId: 'sku-1',
      quantity: 1,
    })
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '已加入购物车', icon: 'success' })
  })

  it('首个加购请求未完成时重复确认只增加一次购物车', async () => {
    const pending = deferred<void>()
    cartState.addToCart = vi.fn(() => pending.promise)
    vi.mocked(getProductDetail).mockResolvedValue(sellableProduct() as any)
    const wrapper = shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()
    const vm = wrapper.vm as any

    vm.handleAddCart()
    const first = vm.confirmSku()
    const second = vm.confirmSku()

    expect(vm.skuSubmitting).toBe(true)
    expect(cartState.addToCart).toHaveBeenCalledTimes(1)

    pending.resolve()
    await Promise.all([first, second])

    expect(cartState.addToCart).toHaveBeenCalledTimes(1)
    expect(vm.skuSubmitting).toBe(false)
  })

  it('加购失败由商品页捕获并提示，不产生未处理 Promise', async () => {
    cartState.addToCart = vi.fn().mockRejectedValue(new Error('network'))
    vi.mocked(getProductDetail).mockResolvedValue(sellableProduct() as any)
    const wrapper = shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()

    ;(wrapper.vm as any).handleAddCart()
    await (wrapper.vm as any).confirmSku()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '加入购物车失败，请稍后重试',
      icon: 'none',
    })
  })

  it('立即购买会把商品、SKU 与数量带入订单确认页，并等待导航完成释放锁', async () => {
    vi.mocked(getProductDetail).mockResolvedValue(sellableProduct() as any)
    const wrapper = shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()

    ;(wrapper.vm as any).handleBuyNow()
    await (wrapper.vm as any).confirmSku()

    expect(userState.requireLogin).not.toHaveBeenCalled()
    expect((globalThis as any).uni.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: '/pages/order/confirm?productId=product-1&skuId=sku-1&quantity=1',
    }))
    expect((wrapper.vm as any).skuSubmitting).toBe(false)
  })

  it('未登录确认购买时只触发登录引导，不写购物车或进入订单页', async () => {
    userState.isLoggedIn = false
    userState.requireLogin = vi.fn()
    vi.mocked(getProductDetail).mockResolvedValue(sellableProduct() as any)
    const wrapper = shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()

    ;(wrapper.vm as any).handleAddCart()
    await (wrapper.vm as any).confirmSku()

    expect(userState.requireLogin).toHaveBeenCalledTimes(1)
    expect(cartState.addToCart).not.toHaveBeenCalled()
    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalled()
  })

  it('库存为零时不能打开购买流程或进入订单确认页', async () => {
    const product = sellableProduct()
    product.stock = 0
    product.skus[0].stock = 0
    vi.mocked(getProductDetail).mockResolvedValue(product as any)
    const wrapper = shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()

    ;(wrapper.vm as any).handleBuyNow()

    expect(userState.requireLogin).not.toHaveBeenCalled()
    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '库存不足', icon: 'none' })
  })

  it('商品接口失败时给出加载失败提示', async () => {
    vi.mocked(getProductDetail).mockRejectedValue(new Error('network'))
    shallowMount(ProductDetailPage)
    lifecycle.onLoadCallbacks.at(-1)?.({ id: 'product-1' })
    await flushPromises()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '商品加载失败', icon: 'none' })
  })
})

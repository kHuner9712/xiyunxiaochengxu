import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CartPage from '../index.vue'

const lifecycle = vi.hoisted(() => ({
  onShowCallbacks: [] as Array<() => void | Promise<void>>,
}))

const mocks = vi.hoisted(() => ({
  cartStore: {
    items: [] as any[],
    checkedCount: 0,
    checkedItems: [] as any[],
    totalPrice: 0,
    allChecked: false,
    toggleCheck: vi.fn(),
    toggleCheckAll: vi.fn(),
    fetchCart: vi.fn(),
    clearCart: vi.fn(),
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
  },
  userStore: {
    isLoggedIn: true,
    requireLogin: vi.fn((callback: () => void) => callback()),
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onShow: vi.fn((callback: () => void | Promise<void>) => lifecycle.onShowCallbacks.push(callback)),
}))

vi.mock('@/stores/cart', () => ({
  useCartStore: () => mocks.cartStore,
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => mocks.userStore,
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

function item(quantity = 1) {
  return {
    id: 'cart-1',
    productId: 'product-1',
    skuId: 'sku-1',
    productName: '测试商品',
    productImage: '',
    skuName: '默认规格',
    price: 1000,
    quantity,
    stock: 10,
    checked: true,
  }
}

function mountCart() {
  return mount(CartPage, {
    global: {
      stubs: {
        PriceDisplay: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  lifecycle.onShowCallbacks = []
  mocks.cartStore.items = [item(1)]
  mocks.cartStore.checkedItems = mocks.cartStore.items
  mocks.cartStore.checkedCount = 1
  mocks.cartStore.totalPrice = 1000
  mocks.cartStore.allChecked = true
  mocks.userStore.isLoggedIn = true
  mocks.userStore.requireLogin.mockImplementation((callback: () => void) => callback())
  mocks.cartStore.updateQuantity.mockResolvedValue(undefined)
  mocks.cartStore.removeItem.mockResolvedValue(undefined)
  mocks.cartStore.fetchCart.mockResolvedValue(true)
  ;(globalThis as any).uni = {
    navigateTo: vi.fn(),
    switchTab: vi.fn(),
    showToast: vi.fn(),
    showModal: vi.fn(),
  }
})

describe('购物车写操作互斥', () => {
  it('数量更新未完成时重复点击只发送一次写请求，并禁止用旧数量结算', async () => {
    const pending = deferred<void>()
    mocks.cartStore.updateQuantity.mockImplementationOnce(() => pending.promise)
    const wrapper = mountCart()
    const vm = wrapper.vm as any

    const first = vm.handleQuantity(0, 1)
    const second = vm.handleQuantity(0, 1)

    expect(vm.cartActionBusy).toBe(true)
    expect(mocks.cartStore.updateQuantity).toHaveBeenCalledTimes(1)
    expect(mocks.cartStore.updateQuantity).toHaveBeenCalledWith('cart-1', 2)

    vm.goCheckout()
    expect(mocks.userStore.requireLogin).not.toHaveBeenCalled()
    expect((globalThis as any).uni.navigateTo).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '购物车正在更新，请稍后结算',
      icon: 'none',
    })

    pending.resolve()
    await Promise.all([first, second])

    expect(mocks.cartStore.updateQuantity).toHaveBeenCalledTimes(1)
    expect(vm.cartActionBusy).toBe(false)
  })

  it('数量减到零的删除确认期间重复点击只打开一个确认框并只删除一次', async () => {
    let modalOptions: any
    ;(globalThis as any).uni.showModal = vi.fn((options: any) => {
      modalOptions = options
    })
    const wrapper = mountCart()
    const vm = wrapper.vm as any

    const first = vm.handleQuantity(0, -1)
    const second = vm.handleQuantity(0, -1)

    expect(vm.cartActionBusy).toBe(true)
    expect((globalThis as any).uni.showModal).toHaveBeenCalledTimes(1)
    expect(mocks.cartStore.removeItem).not.toHaveBeenCalled()

    modalOptions.success?.({ confirm: true })
    await Promise.all([first, second])

    expect(mocks.cartStore.removeItem).toHaveBeenCalledTimes(1)
    expect(mocks.cartStore.removeItem).toHaveBeenCalledWith('cart-1')
    expect(vm.cartActionBusy).toBe(false)
  })
})

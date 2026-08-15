import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AftersaleApplyPage from '../apply.vue'
import { applyAftersale } from '@/api/aftersale'
import { chooseAndUploadImage } from '@/api/upload'

const storeMock = vi.hoisted(() => ({
  userStore: {
    isLoggedIn: true,
    phone: '13800000000',
    requireLogin: vi.fn(),
  },
}))

vi.mock('@dcloudio/uni-app', () => ({
  onLoad: vi.fn(),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => storeMock.userStore,
}))

vi.mock('@/api/aftersale', () => ({
  applyAftersale: vi.fn(),
}))

vi.mock('@/api/order', () => ({
  getOrderDetail: vi.fn(),
}))

vi.mock('@/api/upload', () => ({
  chooseAndUploadImage: vi.fn(),
}))

vi.mock('@/utils/private-file', () => ({
  resolvePrivateFileUrl: vi.fn((url: string) => Promise.resolve(url)),
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

function prepareValidForm(wrapper: ReturnType<typeof mount>) {
  const vm = wrapper.vm as any
  vm.orderId = 'order-1'
  vm.orderItemId = 'item-1'
  vm.form.reason = '质量问题'
  vm.validatingOrder = false
  vm.orderValidated = true
  return vm
}

beforeEach(() => {
  vi.clearAllMocks()
  storeMock.userStore.isLoggedIn = true
  storeMock.userStore.phone = '13800000000'
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    showModal: vi.fn(),
    switchTab: vi.fn(),
    navigateBack: vi.fn(),
  }
})

describe('售后申请提交互斥', () => {
  it('订单详情仍在弱网校验时禁止提前提交', async () => {
    const wrapper = mount(AftersaleApplyPage)
    const vm = wrapper.vm as any
    vm.orderId = 'order-1'
    vm.orderItemId = 'item-1'
    vm.form.reason = '质量问题'

    expect(vm.validatingOrder).toBe(true)
    expect(vm.orderValidated).toBe(false)

    await vm.handleSubmit()

    expect(applyAftersale).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '正在校验订单，请稍后提交',
      icon: 'none',
    })
  })

  it('订单上下文校验失败后仍禁止提交', async () => {
    const wrapper = mount(AftersaleApplyPage)
    const vm = wrapper.vm as any
    vm.orderId = 'order-1'
    vm.orderItemId = 'item-1'
    vm.form.reason = '质量问题'
    vm.validatingOrder = false
    vm.orderValidated = false

    await vm.handleSubmit()

    expect(applyAftersale).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '订单信息尚未通过校验，请重新进入申请页',
      icon: 'none',
    })
  })

  it('图片仍在上传时禁止提交，避免遗漏用户已选择的凭证', async () => {
    const upload = deferred<any[]>()
    vi.mocked(chooseAndUploadImage).mockImplementationOnce(() => upload.promise as any)
    const wrapper = mount(AftersaleApplyPage)
    const vm = prepareValidForm(wrapper)

    const uploadTask = vm.addImage()
    expect(vm.uploading).toBe(true)

    await vm.handleSubmit()

    expect(applyAftersale).not.toHaveBeenCalled()
    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({
      title: '图片仍在上传，请稍后提交',
      icon: 'none',
    })

    upload.resolve([])
    await uploadTask
    expect(vm.uploading).toBe(false)
  })

  it('首个售后申请未完成时重复提交只发送一次请求', async () => {
    const submit = deferred<any>()
    vi.mocked(applyAftersale).mockImplementationOnce(() => submit.promise)
    const wrapper = mount(AftersaleApplyPage)
    const vm = prepareValidForm(wrapper)

    const first = vm.handleSubmit()
    const second = vm.handleSubmit()

    expect(vm.submitting).toBe(true)
    expect(applyAftersale).toHaveBeenCalledTimes(1)

    submit.resolve({})
    await Promise.all([first, second])

    expect(vm.submitting).toBe(false)
    expect(applyAftersale).toHaveBeenCalledTimes(1)
  })
})

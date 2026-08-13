import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerServicePage from '../index.vue'
import { getCustomerServiceConfig } from '@/api/customer-service'

vi.mock('@/api/customer-service', () => ({
  getCustomerServiceConfig: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).uni = {
    showToast: vi.fn(),
    makePhoneCall: vi.fn(),
    previewImage: vi.fn(),
  }
})

describe('客服与帮助页核心操作', () => {
  it('按后台配置展示微信、电话、二维码和 FAQ，并可触发对应原生能力', async () => {
    vi.mocked(getCustomerServiceConfig).mockResolvedValue({
      enabled: true,
      type: 'both',
      phone: '4008001234',
      wechatQrCode: 'https://example.test/customer.png',
      serviceTime: '09:00-18:00',
      autoReplyText: '非工作时间请留言',
      faqContent: JSON.stringify([{ question: '如何退款？', answer: '请在订单详情申请售后。' }]),
      notice: '客服测试公告',
    } as any)

    const wrapper = mount(CustomerServicePage)
    await flushPromises()

    expect(wrapper.text()).toContain('微信客服')
    expect(wrapper.text()).toContain('4008001234')
    expect(wrapper.text()).toContain('09:00-18:00')
    expect(wrapper.text()).toContain('如何退款？')
    expect(wrapper.text()).not.toContain('请在订单详情申请售后。')

    await wrapper.findAll('.entry-item')[1].trigger('tap')
    expect((globalThis as any).uni.makePhoneCall).toHaveBeenCalledWith({ phoneNumber: '4008001234' })

    await wrapper.find('.qrcode-image').trigger('tap')
    expect((globalThis as any).uni.previewImage).toHaveBeenCalledWith({
      urls: ['https://example.test/customer.png'],
    })

    await wrapper.find('.faq-q').trigger('tap')
    expect(wrapper.text()).toContain('请在订单详情申请售后。')
  })

  it('客服关闭或关键渠道缺失时显示明确不可用提示', async () => {
    vi.mocked(getCustomerServiceConfig).mockResolvedValue({
      enabled: false,
      type: 'both',
      phone: '',
      wechatQrCode: '',
      serviceTime: '',
      autoReplyText: '',
      faqContent: '',
      notice: '',
    } as any)

    const wrapper = mount(CustomerServicePage)
    await flushPromises()

    expect(wrapper.text()).toContain('客服暂不可用')
    expect(wrapper.text()).toContain('服务暂不可用，请稍后再试')
    expect(wrapper.find('.contact-entry').exists()).toBe(false)
  })

  it('客服配置接口失败时向用户反馈加载失败', async () => {
    vi.mocked(getCustomerServiceConfig).mockRejectedValue(new Error('network'))
    mount(CustomerServicePage)
    await flushPromises()

    expect((globalThis as any).uni.showToast).toHaveBeenCalledWith({ title: '加载失败', icon: 'none' })
  })
})

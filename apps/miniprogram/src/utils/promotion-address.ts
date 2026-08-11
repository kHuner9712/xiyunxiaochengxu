import { getAddressList } from '@/api/address'

export async function resolvePromotionDeliveryAddressId(sceneName: string): Promise<string | null> {
  try {
    const list = await getAddressList()
    const selected = list.find(item => item.isDefault) || list[0]
    if (selected?.id) return String(selected.id)
  } catch (error) {
    console.error(`[baby-mall] ${sceneName} load address failed:`, error)
    uni.showToast({ title: '加载收货地址失败', icon: 'none' })
    return null
  }

  uni.showModal({
    title: '请先添加收货地址',
    content: `${sceneName}下单需要收货地址，添加后返回本页即可继续购买。`,
    confirmText: '去添加',
    success: ({ confirm }) => {
      if (confirm) uni.navigateTo({ url: '/pages/address/list' })
    },
  })
  return null
}

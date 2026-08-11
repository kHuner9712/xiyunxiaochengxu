import { getProductDetail } from '@/api/product'
import { getPickupStoreList, type PickupStoreItem } from '@/api/pickup-store'
import { resolvePromotionDeliveryAddressId } from '@/utils/promotion-address'

export interface PromotionFulfillmentSelection {
  fulfillmentType: 'delivery' | 'pickup'
  addressId?: string
  pickupStoreId?: string
}

function choosePickupStore(stores: PickupStoreItem[]): Promise<PickupStoreItem | null> {
  if (stores.length === 0) return Promise.resolve(null)
  if (stores.length === 1) return Promise.resolve(stores[0])

  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: stores.slice(0, 6).map((store) => {
        const address = store.fullAddress || `${store.province || ''}${store.city || ''}${store.district || ''}${store.address || ''}`
        return `${store.name}${address ? ` · ${address}` : ''}`.slice(0, 60)
      }),
      success: ({ tapIndex }) => resolve(stores[tapIndex] || null),
      fail: () => resolve(null),
    })
  })
}

export async function resolvePromotionFulfillment(
  productId: string,
  sceneName: string,
): Promise<PromotionFulfillmentSelection | null> {
  let product
  try {
    product = await getProductDetail(productId)
  } catch (error) {
    console.error(`[baby-mall] ${sceneName} load product fulfillment failed:`, error)
    uni.showToast({ title: '商品履约信息加载失败', icon: 'none' })
    return null
  }

  const fulfillmentType = product.fulfillmentType || 'delivery'
  if (fulfillmentType === 'delivery') {
    const addressId = await resolvePromotionDeliveryAddressId(sceneName)
    return addressId ? { fulfillmentType: 'delivery', addressId } : null
  }

  if (fulfillmentType === 'pickup') {
    let stores: PickupStoreItem[] = []
    try {
      const result = await getPickupStoreList({ page: 1, pageSize: 50 })
      stores = (result.list || []).filter((store) => store.status === 1)
    } catch (error) {
      console.error(`[baby-mall] ${sceneName} load pickup stores failed:`, error)
      uni.showToast({ title: '自提点加载失败', icon: 'none' })
      return null
    }

    if (stores.length === 0) {
      uni.showModal({
        title: '暂无可用自提点',
        content: `${sceneName}商品仅支持到店自提，但当前没有启用的自提点，请联系客服。`,
        showCancel: false,
        confirmText: '我知道了',
      })
      return null
    }

    const selected = await choosePickupStore(stores)
    return selected?.id
      ? { fulfillmentType: 'pickup', pickupStoreId: String(selected.id) }
      : null
  }

  uni.showModal({
    title: '当前商品不可参加该活动',
    content: `${sceneName}仅支持快递配送或到店自提商品，当前商品履约方式为 ${fulfillmentType}。`,
    showCancel: false,
    confirmText: '我知道了',
  })
  return null
}

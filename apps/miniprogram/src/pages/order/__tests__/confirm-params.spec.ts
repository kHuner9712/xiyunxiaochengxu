import { CART_MAX_ITEMS, CART_MAX_QUANTITY } from '@baby-mall/shared'
import { describe, expect, it } from 'vitest'
import { parseOrderConfirmItemsParam, parseSingleOrderConfirmItem } from '../confirm-params'

const validItems = [
  {
    productId: '101',
    skuId: '201',
    quantity: 2,
    productName: '测试商品',
    productImage: '/p.png',
    skuName: '标准装',
    price: 1990,
  },
]

describe('确认订单入口参数', () => {
  it('接受 URL 编码和未编码的合法购物车 JSON', () => {
    const raw = JSON.stringify(validItems)
    expect(parseOrderConfirmItemsParam(raw)).toEqual(validItems)
    expect(parseOrderConfirmItemsParam(encodeURIComponent(raw))).toEqual(validItems)
  })

  it('畸形编码、非数组、空数组和非法商品字段都 fail closed', () => {
    expect(parseOrderConfirmItemsParam('%E0%A4%A')).toBeNull()
    expect(parseOrderConfirmItemsParam(JSON.stringify({ items: validItems }))).toBeNull()
    expect(parseOrderConfirmItemsParam('[]')).toBeNull()
    expect(parseOrderConfirmItemsParam(JSON.stringify([{ ...validItems[0], skuId: '' }]))).toBeNull()
    expect(parseOrderConfirmItemsParam(JSON.stringify([{ ...validItems[0], productId: '0' }]))).toBeNull()
    expect(parseOrderConfirmItemsParam(JSON.stringify([{ ...validItems[0], quantity: 0 }]))).toBeNull()
    expect(parseOrderConfirmItemsParam(JSON.stringify([{ ...validItems[0], quantity: 1.5 }]))).toBeNull()
  })

  it('数量和订单项数与后端共享上限保持一致', () => {
    expect(parseOrderConfirmItemsParam(JSON.stringify([
      { ...validItems[0], quantity: CART_MAX_QUANTITY },
    ]))?.[0].quantity).toBe(CART_MAX_QUANTITY)
    expect(parseOrderConfirmItemsParam(JSON.stringify([
      { ...validItems[0], quantity: CART_MAX_QUANTITY + 1 },
    ]))).toBeNull()

    const maxItems = Array.from({ length: CART_MAX_ITEMS }, (_, index) => ({
      ...validItems[0],
      productId: String(1000 + index),
      skuId: String(2000 + index),
      quantity: 1,
    }))
    expect(parseOrderConfirmItemsParam(JSON.stringify(maxItems))).toHaveLength(CART_MAX_ITEMS)
    expect(parseOrderConfirmItemsParam(JSON.stringify([
      ...maxItems,
      {
        ...validItems[0],
        productId: '999999',
        skuId: '999999',
        quantity: 1,
      },
    ]))).toBeNull()
  })

  it('拒绝重复 SKU，避免进入后端必然拒绝的订单试算/创建链', () => {
    expect(parseOrderConfirmItemsParam(JSON.stringify([
      validItems[0],
      { ...validItems[0], productId: '102', quantity: 1 },
    ]))).toBeNull()
  })

  it('单品直购只接受后端允许范围内的正整数商品/SKU ID 和正整数数量，并保持数组不变量', () => {
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '201', quantity: '3' })).toEqual([{
      productId: '101',
      skuId: '201',
      quantity: 3,
      productName: '',
      productImage: '',
      skuName: '',
      price: 0,
    }])
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '201', quantity: CART_MAX_QUANTITY })).toEqual([
      expect.objectContaining({ quantity: CART_MAX_QUANTITY }),
    ])
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '201', quantity: CART_MAX_QUANTITY + 1 })).toBeNull()
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '', quantity: 1 })).toBeNull()
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '201', quantity: 'NaN' })).toBeNull()
  })
})

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

  it('拒绝重复 SKU，避免进入后端必然拒绝的订单试算/创建链', () => {
    expect(parseOrderConfirmItemsParam(JSON.stringify([
      validItems[0],
      { ...validItems[0], productId: '102', quantity: 1 },
    ]))).toBeNull()
  })

  it('单品直购只接受正整数商品/SKU ID 和正整数数量', () => {
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '201', quantity: '3' })).toEqual({
      productId: '101',
      skuId: '201',
      quantity: 3,
      productName: '',
      productImage: '',
      skuName: '',
      price: 0,
    })
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '', quantity: 1 })).toBeNull()
    expect(parseSingleOrderConfirmItem({ productId: '101', skuId: '201', quantity: 'NaN' })).toBeNull()
  })
})

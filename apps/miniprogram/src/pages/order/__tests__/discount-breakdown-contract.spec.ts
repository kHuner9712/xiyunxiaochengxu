import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function read(relativePath: string) {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('订单金额明细展示契约', () => {
  it('确认页展示会员优惠与活动优惠，并使用服务端折扣字段', () => {
    const source = read('../confirm.vue')

    expect(source).toContain('会员优惠')
    expect(source).toContain('活动优惠')
    expect(source).toContain('preview.value.discountAmount')
    expect(source).toContain('preview.value.activityDiscountAmount')
  })

  it('详情页展示会员优惠与活动优惠，商品行不冒充实付小计', () => {
    const source = read('../detail.vue')

    expect(source).toContain('order.discountAmount')
    expect(source).toContain('order.activityDiscountAmount')
    expect(source).toContain('会员优惠')
    expect(source).toContain('活动优惠')
    expect(source).toContain('商品小计')
    expect(source).not.toContain('实付小计')
  })

  it('订单列表不把未分摊优惠的商品行小计标成实付金额', () => {
    const source = read('../list.vue')

    expect(source).toContain('商品小计')
    expect(source).not.toContain('实付小计')
  })

  it('订单详情类型暴露后端真实折扣字段', () => {
    const source = read('../../../api/order.ts')

    expect(source).toContain('discountAmount: number')
    expect(source).toContain('activityDiscountAmount: number')
  })
})

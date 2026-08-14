import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const source = fs.readFileSync(path.resolve(__dirname, '../confirm.vue'), 'utf8')

describe('order confirm production locks', () => {
  it('counts actual purchased quantity instead of sku rows', () => {
    expect(source).toContain('共 {{ orderItemCount }} 件')
    expect(source).toContain('orderItems.value.reduce((total, item) =>')
    expect(source).not.toContain('共 {{ orderItems.length }} 件')
  })

  it('does not allow order submission while the newest quote is still loading', () => {
    expect(source).toContain(':class="{ disabled: submitting || loading }"')
    expect(source).toContain("if (loading.value) {")
    expect(source).toContain("订单金额正在计算，请稍后提交")
  })

  it('treats payment creation failure as a recoverable created-order state', () => {
    expect(source).toContain('订单已创建，但支付发起失败。请进入订单详情继续支付。')
    expect(source).toContain("confirmText: '查看订单'")
    expect(source).not.toContain('支付功能暂未开放，请联系客服')
  })
})

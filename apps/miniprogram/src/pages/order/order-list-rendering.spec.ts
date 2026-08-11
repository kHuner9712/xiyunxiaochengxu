import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('order list rendering contract', () => {
  it('keys order lines by unique order-item id so same-SKU gifts render independently', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/pages/order/list.vue'), 'utf8')

    expect(source).toContain('v-for="item in order.items" :key="item.id"')
    expect(source).not.toContain('v-for="item in order.items" :key="item.skuId"')
  })
})

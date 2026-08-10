import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('order list rendering contract', () => {
  it('keys order lines by unique order-item id so same-SKU gifts render independently', () => {
    const source = readFileSync(fileURLToPath(new URL('./list.vue', import.meta.url)), 'utf8')

    expect(source).toContain('v-for="item in order.items" :key="item.id"')
    expect(source).not.toContain('v-for="item in order.items" :key="item.skuId"')
  })
})

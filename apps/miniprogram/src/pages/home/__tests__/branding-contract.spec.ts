import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const homePage = readFileSync(resolve(process.cwd(), 'src/pages/home/index.vue'), 'utf8')
const homeApi = readFileSync(resolve(process.cwd(), 'src/api/home.ts'), 'utf8')

describe('首页商城品牌配置链', () => {
  it('首页 API 类型包含品牌名称和 Logo', () => {
    expect(homeApi).toContain('brand: StorefrontBrand')
    expect(homeApi).toContain('export interface StorefrontBrand')
    expect(homeApi).toContain('name: string')
    expect(homeApi).toContain('logo: string')
  })

  it('首页展示和分享都消费动态品牌配置，并保留安全默认值', () => {
    expect(homePage).toContain('v-if="homeData.brand.logo"')
    expect(homePage).toContain('{{ homeData.brand.name }}')
    expect(homePage).toContain("brand: { name: '禧孕优选', logo: '' }")
    expect(homePage).toContain("`${homeData.brand.name || '禧孕优选'} - 品质母婴好物`")
    expect(homePage).not.toContain('<text class="brand-title">禧孕优选</text>')
  })
})

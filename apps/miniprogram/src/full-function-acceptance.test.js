const manifest = require('../acceptance/wechat-page-manifest.json')

const mode = String(process.env.WECHAT_ACCEPTANCE_MODE || 'smoke').toLowerCase()
const isFull = mode === 'full'

function buildRoute(entry) {
  const params = new URLSearchParams()
  for (const [queryKey, envName] of Object.entries(entry.queryEnv || {})) {
    const raw = String(process.env[envName] || '').trim()
    if (!raw) throw new Error(`${entry.path} requires ${envName}`)
    params.set(queryKey, raw)
  }
  const query = params.toString()
  return `/${entry.path}${query ? `?${query}` : ''}`
}

function selectedPages() {
  if (isFull) return manifest.pages
  return manifest.pages.filter((entry) => !entry.authRequired && !entry.queryEnv)
}

describe(`禧孕优选微信小程序 ${mode} page acceptance`, () => {
  beforeAll(async () => {
    if (isFull) {
      const token = await program.callUniMethod('getStorageSync', 'baby_mall_token')
      expect(String(token || '').trim()).not.toBe('')
    }
  })

  for (const entry of selectedPages()) {
    test(`${entry.path} can be opened and remains on the intended page`, async () => {
      const route = buildRoute(entry)
      let page = await program.reLaunch(route)
      await page.waitFor(entry.readySelector || 1200)
      page = await program.currentPage()

      expect(page.path).toBe(entry.path)
      const size = await page.size()
      expect(Number(size.width)).toBeGreaterThan(0)
      expect(Number(size.height)).toBeGreaterThan(0)

      if (entry.readySelector) {
        const element = await page.$(entry.readySelector)
        expect(element).toBeTruthy()
      }
    }, 20000)
  }
})

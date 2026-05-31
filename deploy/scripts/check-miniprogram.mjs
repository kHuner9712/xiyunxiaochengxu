import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const miniDir = join(root, 'apps/miniprogram')
const srcDir = join(miniDir, 'src')
const packagePath = join(miniDir, 'package.json')
const pagesPath = join(srcDir, 'pages.json')
const distDir = join(miniDir, 'dist/build/mp-weixin')

const fail = (message) => {
  console.error(`[miniprogram-check] FAIL ${message}`)
  process.exitCode = 1
}

const pass = (message) => console.log(`[miniprogram-check] PASS ${message}`)
const warn = (message) => console.warn(`[miniprogram-check] WARN ${message}`)

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const pkg = readJson(packagePath)
const dcloudEntries = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter(([name]) => name.startsWith('@dcloudio/'))
  .filter(([name]) => name !== '@dcloudio/types')

if (dcloudEntries.length === 0) {
  fail('no @dcloudio/* dependencies found')
} else {
  const versions = new Set(dcloudEntries.map(([, version]) => version))
  const rangeEntries = dcloudEntries.filter(([, version]) => /^[~^*><=]/.test(version))
  if (rangeEntries.length > 0) {
    fail(`@dcloudio/* dependencies must be exact versions: ${rangeEntries.map(([name, version]) => `${name}@${version}`).join(', ')}`)
  } else {
    pass('@dcloudio/* dependencies use exact versions')
  }
  if (versions.size !== 1) {
    fail(`@dcloudio/* dependencies must stay on one locked compiler version: ${[...versions].join(', ')}`)
  } else {
    pass(`@dcloudio/* dependencies locked to ${[...versions][0]}`)
  }
}

const pages = readJson(pagesPath)
const pagePaths = [
  ...(pages.pages || []).map((page) => page.path),
  ...(pages.subPackages || pages.subpackages || []).flatMap((pkg) =>
    (pkg.pages || []).map((page) => `${pkg.root.replace(/\/+$/, '')}/${page.path}`),
  ),
]

for (const pagePath of pagePaths) {
  const vuePath = join(srcDir, `${pagePath}.vue`)
  if (existsSync(vuePath)) {
    pass(`page exists: ${pagePath}.vue`)
  } else {
    fail(`page missing: ${pagePath}.vue`)
  }
}

for (const item of pages.tabBar?.list || []) {
  for (const key of ['iconPath', 'selectedIconPath']) {
    const icon = item[key]
    if (!icon) continue
    const iconPath = join(srcDir, icon)
    if (existsSync(iconPath)) {
      pass(`tabBar icon exists: ${icon}`)
    } else {
      fail(`tabBar icon missing: ${icon}`)
    }
  }
}

const sizeOf = (path) => {
  const stat = statSync(path)
  if (stat.isFile()) return stat.size
  return readdirSync(path).reduce((sum, entry) => sum + sizeOf(join(path, entry)), 0)
}

if (!existsSync(distDir)) {
  warn('dist/build/mp-weixin not found; size check will run after mp-weixin build')
} else {
  const total = sizeOf(distDir)
  const mainLimit = 2 * 1024 * 1024
  const totalLimit = 20 * 1024 * 1024
  if (total > totalLimit) {
    fail(`mp-weixin total package size exceeds 20MB: ${total} bytes`)
  } else if (pagePaths.length > 0 && total > mainLimit && !(pages.subPackages || pages.subpackages)) {
    fail(`mp-weixin main package size exceeds 2MB and no subPackages configured: ${total} bytes`)
  } else {
    pass(`mp-weixin package size within configured limits: ${total} bytes`)
  }
}

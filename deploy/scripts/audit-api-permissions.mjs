import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const srcDir = join(root, 'apps/api/src')

const routeDecorators = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'All']
const allowedPublicPrefixes = [
  'admin/auth',
  'weapp/auth',
  'health',
  'weapp/pay/callback',
  'weapp/pay/refund-callback',
  'weapp/product',
  'weapp/category',
  'weapp/brand',
  'weapp/content',
  'weapp/home',
  'weapp/activity',
  'weapp/search',
  'weapp/coupon',
  'weapp/member',
  'weapp/pickup-store',
  'weapp/customer-service',
  'weapp/share',
  'common/file',
]

const adminSelfServicePrefixes = ['admin/auth']
const weappNoUserIdAllowedRoutes = ['weapp/auth/login', 'weapp/points/rules']

const files = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (entry.name.endsWith('.controller.ts')) files.push(path)
  }
}
walk(srcDir)

let failed = false
const publicRoutes = []
const failures = []

function normalizeRoute(...parts) {
  return parts
    .filter(Boolean)
    .join('/')
    .replace(/['"`]/g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
}

function addFailure(file, message) {
  failed = true
  failures.push(`${file.replace(root + '\\', '').replaceAll('\\', '/')}: ${message}`)
}

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const classRegex = /((?:@\w+(?:\([^)]*\))?\s*)*)export\s+class\s+(\w+)/g
  const classes = [...source.matchAll(classRegex)]

  for (let index = 0; index < classes.length; index++) {
    const match = classes[index]
    const decorators = match[1] || ''
    const className = match[2]
    const classStart = match.index
    const bodyStart = source.indexOf('{', classStart)
    const bodyEnd = index + 1 < classes.length ? classes[index + 1].index : source.length
    const body = source.slice(bodyStart + 1, bodyEnd)
    const controllerMatch = decorators.match(/@Controller\(([^)]*)\)/)
    if (!controllerMatch) continue

    const controllerPath = normalizeRoute(controllerMatch[1])
    const classHasPermission = /@RequirePermission\(/.test(decorators)
    const classIsPublic = /@Public\(\)/.test(decorators)

    const methodRegex = new RegExp(
      `((?:\\s*@(?:${routeDecorators.join('|')}|RequirePermission|Public|OptionalAuth|UseInterceptors|UseGuards|SkipTransform|SkipThrottle)\\([^)]*\\)\\s*)+)\\s*async\\s+(\\w+)\\s*\\(([^)]*)\\)`,
      'g',
    )
    const methods = [...body.matchAll(methodRegex)]

    if (controllerPath.startsWith('admin/') && !classHasPermission && !adminSelfServicePrefixes.includes(controllerPath)) {
      for (const method of methods) {
        const methodDecorators = method[1] || ''
        if (!/@RequirePermission\(/.test(methodDecorators) && !/@Public\(\)/.test(methodDecorators)) {
          addFailure(file, `${className}.${method[2]} is admin route without @RequirePermission`)
        }
      }
    }

    for (const method of methods) {
      const methodDecorators = method[1] || ''
      const methodName = method[2]
      const params = method[3] || ''
      const routeMatch = methodDecorators.match(new RegExp(`@(${routeDecorators.join('|')})\\(([^)]*)\\)`))
      const routePath = normalizeRoute(controllerPath, routeMatch?.[2] || '')
      const isPublic = classIsPublic || /@Public\(\)/.test(methodDecorators)
      const isOptionalAuth = /@OptionalAuth\(\)/.test(methodDecorators)

      if (isPublic) {
        publicRoutes.push(routePath)
        if (!allowedPublicPrefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`))) {
          addFailure(file, `${className}.${methodName} exposes disallowed @Public route: ${routePath}`)
        }
      }

      const hasCurrentUserId = params.includes("@CurrentUser('id'") || params.includes('@CurrentUser("id"') || params.includes('@CurrentUser(`id`')
      if (
        controllerPath.startsWith('weapp/') &&
        !isPublic &&
        !isOptionalAuth &&
        !weappNoUserIdAllowedRoutes.includes(routePath) &&
        !hasCurrentUserId
      ) {
        addFailure(file, `${className}.${methodName} is weapp private route without @CurrentUser('id')`)
      }
    }
  }
}

console.log('[api-permission-audit] Public routes:')
for (const route of publicRoutes.sort()) {
  console.log(`  - ${route}`)
}

if (failed) {
  console.error('[api-permission-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log('[api-permission-audit] PASS')

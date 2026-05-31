import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const requireFromApi = createRequire(join(root, 'apps/api/package.json'))
const ts = requireFromApi('typescript')

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

let srcDir = join(root, 'apps/api/src')
for (let index = 2; index < process.argv.length; index++) {
  const arg = process.argv[index]
  if (arg === '--src-dir') {
    const value = process.argv[index + 1]
    if (!value) {
      console.error('[api-permission-audit] --src-dir requires a value')
      process.exit(2)
    }
    srcDir = resolve(value)
    index++
  } else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node deploy/scripts/audit-api-permissions.mjs [--src-dir path]')
    process.exit(0)
  }
}

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

function relativeFile(file) {
  return relative(root, file).replaceAll('\\', '/')
}

function addFailure(file, message) {
  failed = true
  failures.push(`${relativeFile(file)}: ${message}`)
}

function decoratorsOf(node) {
  return ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : []
}

function decoratorName(decorator) {
  let expression = decorator.expression
  if (ts.isCallExpression(expression)) expression = expression.expression
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  return ''
}

function decoratorCall(decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression : null
}

function findDecorator(decorators, name) {
  return decorators.find((decorator) => decoratorName(decorator) === name)
}

function hasDecorator(decorators, name) {
  return !!findDecorator(decorators, name)
}

function firstArgText(decorator, sourceFile) {
  const call = decoratorCall(decorator)
  const arg = call?.arguments?.[0]
  if (!arg) return ''
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text
  return arg.getText(sourceFile)
}

function routeDecoratorsOf(decorators) {
  return decorators.filter((decorator) => routeDecorators.includes(decoratorName(decorator)))
}

function hasCurrentUserId(method) {
  return method.parameters.some((param) => (
    decoratorsOf(param).some((decorator) => {
      if (decoratorName(decorator) !== 'CurrentUser') return false
      const call = decoratorCall(decorator)
      const arg = call?.arguments?.[0]
      if (!arg) return false
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text === 'id'
      return arg.getText().replace(/['"`]/g, '') === 'id'
    })
  ))
}

function methodName(method) {
  if (method.name && ts.isIdentifier(method.name)) return method.name.text
  return method.name?.getText() || '<anonymous>'
}

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  function visit(node) {
    if (!ts.isClassDeclaration(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const classDecorators = decoratorsOf(node)
    const controllerDecorator = findDecorator(classDecorators, 'Controller')
    if (!controllerDecorator) return

    const controllerPath = normalizeRoute(firstArgText(controllerDecorator, sourceFile))
    const className = node.name?.text || '<anonymous>'
    const classHasPermission = hasDecorator(classDecorators, 'RequirePermission')
    const classIsPublic = hasDecorator(classDecorators, 'Public')

    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member)) continue
      const memberDecorators = decoratorsOf(member)
      const memberRoutes = routeDecoratorsOf(memberDecorators)
      if (memberRoutes.length === 0) continue

      const memberName = methodName(member)
      const methodHasPermission = hasDecorator(memberDecorators, 'RequirePermission')
      const methodIsPublic = hasDecorator(memberDecorators, 'Public')
      const methodIsOptionalAuth = hasDecorator(memberDecorators, 'OptionalAuth')
      const isPublic = classIsPublic || methodIsPublic

      if (
        controllerPath.startsWith('admin/') &&
        !classHasPermission &&
        !adminSelfServicePrefixes.includes(controllerPath) &&
        !methodHasPermission &&
        !methodIsPublic
      ) {
        addFailure(file, `${className}.${memberName} is admin route without @RequirePermission`)
      }

      for (const routeDecorator of memberRoutes) {
        const routePath = normalizeRoute(controllerPath, firstArgText(routeDecorator, sourceFile))

        if (isPublic) {
          publicRoutes.push(routePath)
          if (!allowedPublicPrefixes.some((prefix) => routePath === prefix || routePath.startsWith(`${prefix}/`))) {
            addFailure(file, `${className}.${memberName} exposes disallowed @Public route: ${routePath}`)
          }
        }

        if (
          controllerPath.startsWith('weapp/') &&
          !isPublic &&
          !methodIsOptionalAuth &&
          !weappNoUserIdAllowedRoutes.includes(routePath) &&
          !hasCurrentUserId(member)
        ) {
          addFailure(file, `${className}.${memberName} is weapp private route without @CurrentUser('id')`)
        }
      }
    }
  }

  visit(sourceFile)
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

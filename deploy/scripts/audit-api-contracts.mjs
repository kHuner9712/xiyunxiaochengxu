import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../..')
const requireFromApi = createRequire(join(root, 'apps/api/package.json'))
const ts = requireFromApi('typescript')

const routeMethods = new Map([
  ['Get', 'GET'],
  ['Post', 'POST'],
  ['Put', 'PUT'],
  ['Patch', 'PATCH'],
  ['Delete', 'DELETE'],
])
const clientMethods = new Map([
  ['get', 'GET'],
  ['post', 'POST'],
  ['put', 'PUT'],
  ['patch', 'PATCH'],
  ['delete', 'DELETE'],
  ['del', 'DELETE'],
])

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) walk(absolute, predicate, output)
    else if (predicate(absolute)) output.push(absolute)
  }
  return output
}

function relativeFile(file) {
  return relative(root, file).replaceAll('\\', '/')
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

function pathFromExpression(expression, sourceFile) {
  if (!expression) return ''
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text
  if (ts.isTemplateExpression(expression)) {
    let value = expression.head.text
    for (const span of expression.templateSpans) {
      const rawName = span.expression.getText(sourceFile).replace(/[^A-Za-z0-9_]/g, '') || 'param'
      value += `:${rawName}${span.literal.text}`
    }
    return value
  }
  return null
}

function normalizePath(value) {
  if (value === null || value === undefined) return null
  let path = String(value).trim()
  if (!path) return ''
  path = path.replace(/^https?:\/\/[^/]+/i, '')
  path = path.split('?')[0].split('#')[0]
  path = path.replace(/^\/api(?=\/|$)/, '')
  path = path.replace(/^\/+|\/+$/g, '')
  path = path.replace(/\/+/, '/')
  return path
}

function joinRoute(...parts) {
  return normalizePath(parts.filter(Boolean).join('/')) || ''
}

function segmentsMatch(clientPath, serverPath) {
  const clientSegments = clientPath.split('/').filter(Boolean)
  const serverSegments = serverPath.split('/').filter(Boolean)
  if (clientSegments.length !== serverSegments.length) return false
  return serverSegments.every((segment, index) => (
    segment.startsWith(':')
    || clientSegments[index].startsWith(':')
    || segment === clientSegments[index]
  ))
}

const controllerFiles = walk(join(root, 'apps/api/src'), file => file.endsWith('.controller.ts'))
const serverRoutes = []

for (const file of controllerFiles) {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  function visit(node) {
    if (!ts.isClassDeclaration(node)) {
      ts.forEachChild(node, visit)
      return
    }

    const controllerDecorator = decoratorsOf(node).find(decorator => decoratorName(decorator) === 'Controller')
    if (!controllerDecorator) return
    const controllerArg = decoratorCall(controllerDecorator)?.arguments?.[0]
    const controllerPath = normalizePath(pathFromExpression(controllerArg, sourceFile))
    if (controllerPath === null) return

    for (const member of node.members) {
      if (!ts.isMethodDeclaration(member)) continue
      for (const decorator of decoratorsOf(member)) {
        const name = decoratorName(decorator)
        const method = routeMethods.get(name)
        if (!method) continue
        const routeArg = decoratorCall(decorator)?.arguments?.[0]
        const methodPath = normalizePath(pathFromExpression(routeArg, sourceFile))
        if (methodPath === null) continue
        serverRoutes.push({
          method,
          path: joinRoute(controllerPath, methodPath),
          file: relativeFile(file),
        })
      }
    }
  }

  visit(sourceFile)
}

const clientRoots = [
  join(root, 'apps/admin-web/src/api'),
  join(root, 'apps/miniprogram/src/api'),
]
const clientFiles = clientRoots.flatMap(dir => walk(dir, file => file.endsWith('.ts')))
const clientCalls = []

function addClientCall(method, pathValue, file, node) {
  const normalized = normalizePath(pathValue)
  if (normalized === null || !normalized) return
  if (!/^(admin|weapp|common)\//.test(normalized)) return
  const line = ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1
  clientCalls.push({ method, path: normalized, file: relativeFile(file), line })
}

for (const file of clientFiles) {
  const source = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  function visit(node) {
    if (ts.isCallExpression(node)) {
      let methodName = ''
      if (ts.isPropertyAccessExpression(node.expression)) methodName = node.expression.name.text
      else if (ts.isIdentifier(node.expression)) methodName = node.expression.text

      const method = clientMethods.get(methodName)
      if (method) {
        const pathValue = pathFromExpression(node.arguments[0], sourceFile)
        addClientCall(method, pathValue, file, node)
      } else if (methodName === 'request' && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
        const object = node.arguments[0]
        let requestMethod = 'GET'
        let pathValue = null
        for (const property of object.properties) {
          if (!ts.isPropertyAssignment(property)) continue
          const key = property.name.getText(sourceFile).replace(/['"]/g, '')
          if (key === 'url') pathValue = pathFromExpression(property.initializer, sourceFile)
          if (key === 'method') {
            const rawMethod = pathFromExpression(property.initializer, sourceFile)
            if (rawMethod) requestMethod = rawMethod.toUpperCase()
          }
        }
        addClientCall(requestMethod, pathValue, file, node)
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
}

const failures = []
for (const call of clientCalls) {
  const matched = serverRoutes.some(route => (
    route.method === call.method && segmentsMatch(call.path, route.path)
  ))
  if (!matched) {
    failures.push(`${call.file}:${call.line} ${call.method} /${call.path} has no matching API controller route`)
  }
}

if (serverRoutes.length === 0) failures.push('no API controller routes were discovered')
if (clientCalls.length === 0) failures.push('no frontend API calls were discovered')

if (failures.length > 0) {
  console.error('[api-contract-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`[api-contract-audit] PASS (${serverRoutes.length} server routes, ${clientCalls.length} client calls)`)

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const failures = []

function rel(file) {
  return relative(root, file).replaceAll('\\', '/')
}

function read(file) {
  try {
    return readFileSync(join(root, file), 'utf8')
  } catch (error) {
    failures.push(`${file}: cannot read file (${error.message})`)
    return ''
  }
}

function expectText(file, text, description) {
  if (!read(file).includes(text)) failures.push(`${file}: ${description}`)
}

function expectRegex(file, pattern, description) {
  if (!pattern.test(read(file))) failures.push(`${file}: ${description}`)
}

function rejectRegex(file, pattern, description) {
  if (pattern.test(read(file))) failures.push(`${file}: ${description}`)
}

function walk(dir, predicate, output = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) walk(absolute, predicate, output)
    else if (predicate(absolute)) output.push(absolute)
  }
  return output
}

expectText('apps/api/src/main.ts', "app.setGlobalPrefix('api')", 'global API prefix must remain /api')
expectRegex('apps/api/src/main.ts', /configService\.get<number>\('PORT',\s*3000\)/, 'API default port must be 3000')
expectText('.env.example', 'PORT=3000', 'development API port must be 3000')
expectText('apps/admin-web/src/utils/request.ts', "baseURL: '/api'", 'admin request baseURL must be /api')
expectText('apps/admin-web/vite.config.ts', "'http://localhost:3000'", 'admin dev proxy fallback must target API port 3000')
rejectRegex('apps/admin-web/vite.config.ts', /localhost:8080/, 'stale localhost:8080 API proxy is forbidden')
expectText('apps/miniprogram/src/utils/request.ts', "url.endsWith('/api')", 'production miniprogram API URL must end with /api')

expectText('deploy/docker-compose.yml', '127.0.0.1:${API_HOST_PORT:-3001}:3000', 'API must bind host loopback 3001 to container 3000')
expectText('deploy/docker-compose.yml', '127.0.0.1:${MYSQL_HOST_PORT:-3307}:3306', 'MySQL must remain loopback-only')
expectText('deploy/docker-compose.yml', '127.0.0.1:${REDIS_HOST_PORT:-6379}:6379', 'Redis must remain loopback-only')
expectText('deploy/docker-compose.yml', 'BUILD_SHA: ${BUILD_SHA:-unknown}', 'Compose must pass BUILD_SHA into the image')
expectText('deploy/docker-compose.yml', 'UPLOAD_MAX_SIZE: ${UPLOAD_MAX_SIZE:-52428800}', 'Compose upload default must be 50MB')

for (const file of ['deploy/nginx/conf.d/default.conf', 'deploy/nginx/conf.d/default.conf.template']) {
  expectText(file, 'proxy_pass http://api:3000;', 'Nginx must proxy to api:3000')
}
for (const file of ['deploy/nginx/nginx.conf', 'deploy/nginx/conf.d/default.conf', 'deploy/nginx/conf.d/default.conf.template']) {
  expectText(file, 'client_max_body_size 60m;', 'Nginx request-body limit must be 60m')
  rejectRegex(file, /client_max_body_size\s+20m;/, 'stale 20m upload limit is forbidden')
}
expectText('deploy/nginx/conf.d/default.conf.template', '/etc/nginx/ssl/api/fullchain.pem', 'API certificate path must use ssl/api')
expectText('deploy/nginx/conf.d/default.conf.template', '/etc/nginx/ssl/admin/fullchain.pem', 'admin certificate path must use ssl/admin')
expectText('deploy/nginx/conf.d/default.conf.template', 'proxy_set_header X-Request-Id $request_id;', 'template must preserve request IDs')
expectText('deploy/nginx/conf.d/default.conf.template', 'proxy_set_header Connection $connection_upgrade;', 'template must use the upgrade map')

const dockerfile = read('deploy/Dockerfile.api')
const nodeStages = dockerfile.match(/^FROM node:[^\s]+/gm) || []
if (nodeStages.length !== 3 || nodeStages.some(line => line !== 'FROM node:22.13.0-alpine')) {
  failures.push('deploy/Dockerfile.api: every Node stage must be pinned to node:22.13.0-alpine')
}
expectText('deploy/Dockerfile.api', 'ARG BUILD_SHA=unknown', 'Dockerfile must accept BUILD_SHA')
expectText('deploy/Dockerfile.api', 'printf \'%s\\n\' "$BUILD_SHA" > /app/admin-dist/.build-hash', 'admin build hash must come from BUILD_SHA')
rejectRegex('deploy/Dockerfile.api', /git rev-parse/, 'Docker builds cannot depend on an unavailable .git directory')
expectText('deploy/scripts/entrypoint.sh', 'cp -a /app/admin-dist/. /usr/share/nginx/admin/', 'entrypoint must refresh the shared admin volume')

for (const file of ['.env.example', '.env.production.example']) {
  expectText(file, 'UPLOAD_MAX_SIZE=52428800', 'upload example must be 50MB')
  expectRegex(file, /UPLOAD_ALLOWED_TYPES=.*video\/mp4/, 'MP4 must remain allowed')
}
expectText('.env.production.example', 'WECHAT_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback', 'payment callback must use the production API domain')
expectText('.env.production.example', 'WECHAT_REFUND_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback', 'refund callback must use the production API domain')
expectText('.env.production.example', 'CORS_ORIGINS=https://admin.yunxixiaochengxu.com.cn', 'CORS must use the production admin domain')
expectText('.env.production.example', 'deploy/nginx/ssl/api/fullchain.pem', 'production template must document the API certificate')
expectText('.env.production.example', 'deploy/nginx/ssl/admin/fullchain.pem', 'production template must document the admin certificate')

expectText('apps/miniprogram/vitest.config.ts', 'maxWorkers: 1', 'miniprogram tests must cap workers')
expectText('apps/miniprogram/vitest.config.ts', 'fileParallelism: false', 'miniprogram test files must not run in parallel')

const vueFiles = walk(join(root, 'apps/admin-web/src/views'), file => file.endsWith('.vue'))
for (const file of vueFiles) {
  const source = readFileSync(file, 'utf8')
  const selectPattern = /<el-select\b[^>]*v-model="[^"]*Id"[^>]*>([\s\S]*?)<\/el-select>/g
  for (const match of source.matchAll(selectPattern)) {
    if (/<el-option\b[^>]*:value="[1-9]\d*"/.test(match[0])) {
      failures.push(`${rel(file)}: relational *Id select contains a positive hard-coded numeric option`)
    }
  }
}

if (failures.length > 0) {
  console.error('[runtime-contract-audit] FAIL')
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log('[runtime-contract-audit] PASS')

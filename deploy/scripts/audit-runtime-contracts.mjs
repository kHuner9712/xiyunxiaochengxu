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

function expectCount(file, text, count, description) {
  const occurrences = read(file).split(text).length - 1
  if (occurrences !== count) failures.push(`${file}: ${description} (expected ${count}, found ${occurrences})`)
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

// API prefix and client-side base URL contract.
expectText('apps/api/src/main.ts', "app.setGlobalPrefix('api')", 'global API prefix must remain /api')
expectRegex('apps/api/src/main.ts', /configService\.get<number>\('PORT',\s*3000\)/, 'API default port must be 3000')
expectText('.env.example', 'PORT=3000', 'development API port must be 3000')
expectText('apps/admin-web/src/utils/request.ts', "baseURL: '/api'", 'admin request baseURL must be /api')
expectText('apps/admin-web/vite.config.ts', "'http://localhost:3000'", 'admin dev proxy fallback must target API port 3000')
rejectRegex('apps/admin-web/vite.config.ts', /localhost:8080/, 'stale localhost:8080 API proxy is forbidden')
expectText('apps/miniprogram/src/utils/request.ts', "url.endsWith('/api')", 'production miniprogram API URL must end with /api')

// Every supported Compose entrypoint must expose the same internal and host ports.
const composeFiles = ['deploy/docker-compose.yml', 'deploy/docker-compose.bt.yml']
for (const file of composeFiles) {
  expectText(file, '127.0.0.1:${API_HOST_PORT:-3001}:3000', 'API must bind host loopback 3001 to container 3000')
  expectText(file, '127.0.0.1:${MYSQL_HOST_PORT:-3307}:3306', 'MySQL must remain loopback-only')
  expectText(file, '127.0.0.1:${REDIS_HOST_PORT:-6379}:6379', 'Redis must remain loopback-only')
  expectText(file, 'BUILD_SHA: ${BUILD_SHA:-unknown}', 'Compose must pass BUILD_SHA into the image')
  expectText(file, 'UPLOAD_MAX_SIZE: ${UPLOAD_MAX_SIZE:-52428800}', 'Compose upload default must be 50MB')
  expectRegex(file, /UPLOAD_ALLOWED_TYPES:.*video\/mp4/, 'Compose must allow MP4 uploads')
  expectText(file, "http://localhost:3000/api/health", 'API container healthcheck must use internal port 3000')
  expectText(file, 'REDISCLI_AUTH=', 'Redis healthcheck must authenticate without a command-line password argument')
  expectText(file, '$$REDIS_PASSWORD', 'Redis healthcheck must defer password expansion to the container')
  rejectRegex(file, /(?<!\$)\$REDIS_PASSWORD/, 'Redis healthcheck must not interpolate the secret into Compose config')
  rejectRegex(file, /redis-cli\s+-a\b/, 'Redis healthcheck must not expose the password as a command argument')
  rejectRegex(file, /127\.0\.0\.1:3000:3000/, 'stale host API port 3000 is forbidden')
}

// Nginx reverse proxy, request-size and TLS contract.
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

// Deterministic, pinned Docker build and admin static-volume refresh.
const dockerfile = read('deploy/Dockerfile.api')
const nodeStages = dockerfile.match(/^FROM node:[^\s]+/gm) || []
if (nodeStages.length !== 3 || nodeStages.some(line => line !== 'FROM node:22.13.0-alpine')) {
  failures.push('deploy/Dockerfile.api: every Node stage must be pinned to node:22.13.0-alpine')
}
expectText('deploy/Dockerfile.api', 'ARG BUILD_SHA=unknown', 'Dockerfile must accept BUILD_SHA')
expectText('deploy/Dockerfile.api', 'ARG COREPACK_VERSION=0.34.7', 'Dockerfile must pin a Corepack release compatible with Node 22.13.0')
expectText('deploy/Dockerfile.api', 'ARG PNPM_VERSION=11.2.2', 'Dockerfile pnpm version must match the repository package manager')
expectCount('deploy/Dockerfile.api', 'npm install --global corepack@${COREPACK_VERSION}', 2, 'both build stages must install the pinned Corepack release')
expectCount('deploy/Dockerfile.api', 'COREPACK_NPM_REGISTRY=${NPM_REGISTRY} corepack install --global pnpm@${PNPM_VERSION}', 2, 'both build stages must install pnpm through updated Corepack')
expectCount('deploy/Dockerfile.api', 'test "$(pnpm --version)" = "${PNPM_VERSION}"', 2, 'both build stages must verify the exact pnpm version')
rejectRegex('deploy/Dockerfile.api', /corepack\s+prepare\b/, 'deprecated Corepack prepare bootstrap is forbidden')
rejectRegex('deploy/Dockerfile.api', /COREPACK_INTEGRITY_KEYS=(?:0|['"]?['"]?)/, 'Corepack signature verification must not be disabled')
expectText('deploy/Dockerfile.api', 'printf \'%s\\n\' "$BUILD_SHA" > /app/admin-dist/.build-hash', 'admin build hash must come from BUILD_SHA')
rejectRegex('deploy/Dockerfile.api', /git rev-parse/, 'Docker builds cannot depend on an unavailable .git directory')
expectText('deploy/scripts/entrypoint.sh', 'cp -a /app/admin-dist/. /usr/share/nginx/admin/', 'entrypoint must refresh the shared admin volume')

// Upload, callback and certificate examples must match production behavior.
for (const file of ['.env.example', '.env.production.example']) {
  expectText(file, 'UPLOAD_MAX_SIZE=52428800', 'upload example must be 50MB')
  expectRegex(file, /UPLOAD_ALLOWED_TYPES=.*video\/mp4/, 'MP4 must remain allowed')
}
expectText('.env.production.example', 'WECHAT_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/callback', 'payment callback must use the production API domain')
expectText('.env.production.example', 'WECHAT_REFUND_NOTIFY_URL=https://api.yunxixiaochengxu.com.cn/api/weapp/pay/refund-callback', 'refund callback must use the production API domain')
expectText('.env.production.example', 'CORS_ORIGINS=https://admin.yunxixiaochengxu.com.cn', 'CORS must use the production admin domain')
expectText('.env.production.example', 'deploy/nginx/ssl/api/fullchain.pem', 'production template must document the API certificate')
expectText('.env.production.example', 'deploy/nginx/ssl/admin/fullchain.pem', 'production template must document the admin certificate')

// Production deploy and smoke must be the only canonical operational path.
expectText('.gitignore', '/deploy/backups/', 'generated production database backups must be ignored by Git')
expectText('deploy/scripts/deploy-production.sh', 'BUILD_SHA="$(git rev-parse --short HEAD)"', 'deployment must inject the current Git SHA')
expectText('deploy/scripts/deploy-production.sh', 'mysqldump', 'deployment must create a database backup')
expectText('deploy/scripts/deploy-production.sh', 'npx prisma migrate deploy', 'deployment must execute Prisma migrations')
expectText('deploy/scripts/deploy-production.sh', 'bash "$SCRIPT_DIR/smoke-runtime.sh"', 'deployment must run the runtime smoke suite')
expectText('deploy/scripts/deploy-production.sh', 'deploy/nginx/ssl/api/fullchain.pem', 'deployment must validate the API certificate')
expectText('deploy/scripts/deploy-production.sh', 'deploy/nginx/ssl/admin/fullchain.pem', 'deployment must validate the admin certificate')
rejectRegex('deploy/scripts/deploy-production.sh', /62\.234\.69\.19/, 'deployment must not contain a hard-coded server IP')
expectText('deploy/scripts/deploy-prod-check.sh', 'deploy-production.sh', 'legacy deploy entrypoint must delegate to the audited deployment')
expectText('package.json', '"deploy:prod": "bash deploy/scripts/deploy-production.sh"', 'package scripts must expose the audited production deploy command')
expectText('package.json', '"smoke": "bash deploy/scripts/smoke-runtime.sh"', 'package scripts must expose the runtime smoke command')

// Local test stability: prevent high-core hosts from spawning many Vitest workers.
expectText('apps/miniprogram/vitest.config.ts', 'maxWorkers: 1', 'miniprogram tests must cap workers')
expectText('apps/miniprogram/vitest.config.ts', 'fileParallelism: false', 'miniprogram test files must not run in parallel')

// Prevent database relation controls from silently hard-coding primary keys again.
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
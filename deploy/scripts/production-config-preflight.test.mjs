import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const expectedSerial = 'ABCDEF123456'

function spawn(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })
}

function runPreflight(env) {
  return spawn(
    pnpmCommand,
    ['--filter', '@baby-mall/api', 'exec', 'ts-node', 'src/config/production-config-preflight.ts'],
    { env },
  )
}

function createCryptoFixture(dir) {
  const privateKeyPath = join(dir, 'merchant-private-key.pem')
  const platformCertPath = join(dir, 'wechatpay-platform.pem')
  const result = spawn('openssl', [
    'req',
    '-x509',
    '-newkey', 'rsa:2048',
    '-nodes',
    '-keyout', privateKeyPath,
    '-out', platformCertPath,
    '-subj', '/CN=WeChat Pay Preflight Fixture',
    '-days', '30',
    '-set_serial', `0x${expectedSerial}`,
  ])
  assert.equal(result.status, 0, `openssl fixture generation failed: ${result.stderr || result.stdout}`)
  return { privateKeyPath, platformCertPath }
}

function buildProductionEnv(fixture) {
  return {
    ...process.env,
    NODE_ENV: 'production',
    DATABASE_URL: 'mysql://root:preflight@127.0.0.1:3306/baby_mall_preflight',
    REDIS_HOST: '127.0.0.1',
    REDIS_PASSWORD: 'R7mQ2xL9vC4nK8pW6sF3hJ5y',
    JWT_SECRET: 'Z7mQ2xL9vR4nC8pK6sW3hF5jT1yB0dEe',
    REFRESH_TOKEN_SECRET: 'Q6rN4vK8pC2xM9sW5hF7jL1yT3bD0eAa',
    WECHAT_APP_ID: 'wxe40f76a33427090f',
    WECHAT_APP_SECRET: 'wx-preflight-app-secret',
    WECHAT_MCH_ID: '1900000001',
    WECHAT_MCH_SERIAL_NO: 'A1B2C3D4E5F60708',
    WECHAT_API_V3_KEY: '0123456789ABCDEF0123456789ABCDEF',
    WECHAT_PRIVATE_KEY_PATH: fixture.privateKeyPath,
    WECHAT_PLATFORM_CERT_PATH: fixture.platformCertPath,
    WECHAT_PLATFORM_CERT_SERIAL_NO: expectedSerial,
    WECHAT_PLATFORM_CERT_MAP: JSON.stringify({ [expectedSerial]: fixture.platformCertPath }),
    WECHAT_NOTIFY_URL: 'https://api.example.com/api/weapp/pay/callback',
    WECHAT_REFUND_NOTIFY_URL: 'https://api.example.com/api/weapp/pay/refund-callback',
    WECHAT_SKIP_VERIFY: 'false',
    UPLOAD_PUBLIC_URL: 'https://api.example.com',
    CORS_ORIGINS: 'https://admin.example.com',
    ALERT_WEBHOOK_URL: 'https://alerts.example.com/hook',
    OUTBOUND_HTTP_TIMEOUT_MS: '10000',
    SMOKE_TEST_BYPASS_CAPTCHA: 'false',
  }
}

test('production config preflight executes real crypto checks and rejects dangerous config', () => {
  const opensslVersion = spawn('openssl', ['version'])
  assert.equal(opensslVersion.status, 0, 'openssl is required by the audited production deployment flow')

  const dir = mkdtempSync(join(tmpdir(), 'baby-mall-preflight-'))
  try {
    const fixture = createCryptoFixture(dir)
    const validEnv = buildProductionEnv(fixture)

    const valid = runPreflight(validEnv)
    assert.equal(valid.status, 0, `valid production preflight failed:\n${valid.stderr}\n${valid.stdout}`)
    assert.match(valid.stdout, /PRODUCTION_CONFIG_PREFLIGHT_PASS/)

    const invalidOutboundTimeout = runPreflight({
      ...validEnv,
      OUTBOUND_HTTP_TIMEOUT_MS: '999',
    })
    assert.notEqual(
      invalidOutboundTimeout.status,
      0,
      'invalid outbound HTTP timeout must fail before production runtime or migration side effects',
    )

    const placeholderMerchant = runPreflight({
      ...validEnv,
      WECHAT_MCH_ID: 'REPLACE_WITH_REAL_MCH_ID',
    })
    assert.notEqual(
      placeholderMerchant.status,
      0,
      'obvious production template placeholders must fail before payment/runtime side effects',
    )
    assert.match(`${placeholderMerchant.stderr}\n${placeholderMerchant.stdout}`, /模板占位值/)

    const placeholderDatabaseUrl = runPreflight({
      ...validEnv,
      DATABASE_URL: 'mysql://root:REPLACE_WITH_PERCENT_ENCODED_DB_PASSWORD@mysql:3306/baby_mall',
    })
    assert.notEqual(
      placeholderDatabaseUrl.status,
      0,
      'placeholder database credentials must fail before any database connection or migration',
    )

    const wrongSerial = runPreflight({
      ...validEnv,
      WECHAT_PLATFORM_CERT_SERIAL_NO: 'ABCDEF123457',
    })
    assert.notEqual(wrongSerial.status, 0, 'mismatched platform certificate serial must fail preflight')

    const badKeyPath = join(dir, 'bad-private-key.pem')
    writeFileSync(badKeyPath, 'not-a-private-key\n')
    const badKey = runPreflight({
      ...validEnv,
      WECHAT_PRIVATE_KEY_PATH: badKeyPath,
    })
    assert.notEqual(badKey.status, 0, 'unparseable merchant private key must fail preflight')

    const nonCanonicalMapSerial = runPreflight({
      ...validEnv,
      WECHAT_PLATFORM_CERT_MAP: JSON.stringify({ [expectedSerial.toLowerCase()]: fixture.platformCertPath }),
    })
    assert.notEqual(nonCanonicalMapSerial.status, 0, 'non-canonical certificate rotation serial must fail preflight')

    const insecureAlert = runPreflight({
      ...validEnv,
      ALERT_WEBHOOK_URL: 'http://alerts.example.com/hook',
    })
    assert.notEqual(insecureAlert.status, 0, 'production critical alert webhook must require HTTPS')

    assert.match(readFileSync(fixture.platformCertPath, 'utf8'), /BEGIN CERTIFICATE/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('direct production bootstrap invokes preflight before NestFactory creates providers', () => {
  const main = readFileSync(resolve(root, 'apps/api/src/main.ts'), 'utf8')
  const preflightIndex = main.indexOf('runProductionConfigPreflight(process.env)')
  const nestCreateIndex = main.indexOf('NestFactory.create')

  assert.ok(preflightIndex >= 0, 'main.ts must invoke production config preflight')
  assert.ok(nestCreateIndex >= 0, 'main.ts must create the Nest application')
  assert.ok(preflightIndex < nestCreateIndex, 'production preflight must run before Nest providers and schedulers start')
})

test('production deploy quiesces all writers before the proof backup and rolls back safely before public exposure', () => {
  const deploy = readFileSync(resolve(root, 'deploy/scripts/deploy-production.sh'), 'utf8')
  const entrypoint = readFileSync(resolve(root, 'deploy/scripts/entrypoint.sh'), 'utf8')
  const redis = readFileSync(resolve(root, 'apps/api/src/common/redis/redis.service.ts'), 'utf8')
  const smoke = readFileSync(resolve(root, 'deploy/scripts/smoke-runtime.sh'), 'utf8')

  const buildIndex = deploy.indexOf('build --pull api')
  const maintenanceIndex = deploy.indexOf('MAINTENANCE_ACTIVE=true')
  const stopNginxIndex = deploy.indexOf('docker stop -t 10 baby-mall-nginx')
  const stopApiIndex = deploy.indexOf('docker stop -t 30 baby-mall-api')
  const backupIndex = deploy.indexOf('write-quiesced database backup created')
  const cloneIndex = deploy.indexOf('write-quiesced production backup restored into disposable migration clone')
  const liveTouchedIndex = deploy.lastIndexOf('LIVE_DB_TOUCHED=true')
  const liveMigrationIndex = deploy.lastIndexOf('run --rm --no-deps api npx prisma migrate deploy')
  const candidateHealthIndex = deploy.indexOf('candidate API is healthy while public Nginx remains stopped')
  const publicExposeIndex = deploy.indexOf('PUBLIC_EXPOSED=true')
  const smokeIndex = deploy.indexOf('smoke-runtime.sh')

  for (const [label, value] of Object.entries({
    buildIndex,
    maintenanceIndex,
    stopNginxIndex,
    stopApiIndex,
    backupIndex,
    cloneIndex,
    liveTouchedIndex,
    liveMigrationIndex,
    candidateHealthIndex,
    publicExposeIndex,
    smokeIndex,
  })) {
    assert.ok(value >= 0, `deployment contract missing ${label}`)
  }

  assert.match(deploy, /command -v curl[^\n]*fail 'curl is not installed'/)
  assert.ok(buildIndex < maintenanceIndex, 'candidate image must build before downtime starts')
  assert.ok(maintenanceIndex < stopNginxIndex, 'maintenance state must be armed before stopping public ingress')
  assert.ok(stopNginxIndex < stopApiIndex, 'public ingress must stop before API/background writers drain')
  assert.ok(stopApiIndex < backupIndex, 'proof backup must be taken only after API/background writers stop')
  assert.ok(backupIndex < cloneIndex, 'the exact quiesced backup must feed migration-clone verification')
  assert.ok(cloneIndex < liveTouchedIndex, 'clone verification must finish before the live database is marked mutable')
  assert.ok(liveTouchedIndex < liveMigrationIndex, 'rollback trap must be armed before live migration starts')
  assert.ok(liveMigrationIndex < candidateHealthIndex, 'candidate API health comes after the live schema migration')
  assert.ok(candidateHealthIndex < publicExposeIndex, 'candidate must be healthy before Nginx is reopened')
  assert.ok(publicExposeIndex < smokeIndex, 'full trusted-HTTPS smoke runs only after publication')

  assert.match(deploy, /restore_live_database\(\)/)
  assert.match(deploy, /DROP DATABASE IF EXISTS/)
  assert.match(deploy, /restore_previous_runtime\(\)/)
  assert.match(deploy, /PUBLIC_EXPOSED.*automatic database rollback is disabled/s)
  assert.match(deploy, /candidate API business route and Nginx configuration pass before public exposure/)

  assert.match(entrypoint, /\.scheduler-paused/)
  assert.match(entrypoint, /\$\{BUILD_SHA:-unknown\}/)
  assert.match(redis, /key\.startsWith\('schedule:'\)/)
  assert.match(redis, /markerBuild === currentBuild/)
  assert.match(smoke, /scheduler_pause_marker/)
  assert.match(smoke, /scheduler_pause_marker.*api_build_sha/s)
  assert.match(smoke, /rm -f.*\.scheduler-paused/)
})

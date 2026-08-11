import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import { createPrivateKey, X509Certificate } from 'crypto';
import * as fs from 'fs';
import { configureOutboundHttpTimeout } from '../common/http/outbound-http-timeout';
import { PaymentService } from '../payment/payment.service';
import { validateEnv } from './env.validation';

const MIN_PLATFORM_CERT_VALIDITY_MS = 24 * 60 * 60 * 1000;
const CANONICAL_CERT_SERIAL = /^[0-9A-F]+$/;
const PLACEHOLDER_SENSITIVE_KEYS = [
  'DATABASE_URL',
  'DB_PASSWORD',
  'REDIS_PASSWORD',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'WECHAT_APP_ID',
  'WECHAT_APP_SECRET',
  'WECHAT_MCH_ID',
  'WECHAT_MCH_SERIAL_NO',
  'WECHAT_API_V3_KEY',
  'WECHAT_PLATFORM_CERT_SERIAL_NO',
  'ADMIN_DEFAULT_PASSWORD',
] as const;
const PLACEHOLDER_MARKERS = [
  'REPLACE_WITH_',
  'CHANGE_ME',
  'CHANGE_THIS',
  'CHANGEME',
  '<REPLACE',
  'YOUR_',
] as const;

function fail(message: string): never {
  throw new Error(`生产配置预检失败: ${message}`);
}

function rejectObviousPlaceholderValues(env: NodeJS.ProcessEnv): void {
  for (const key of PLACEHOLDER_SENSITIVE_KEYS) {
    const raw = String(env[key] || '').trim();
    if (!raw) continue;
    const normalized = raw.toUpperCase();
    if (PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))) {
      fail(`${key} 仍是模板占位值，必须在生产部署前替换为真实配置`);
    }
  }
}

function decodeDatabaseUrlPart(value: string, label: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    fail(`DATABASE_URL 的 ${label} 不是合法的 percent-encoding`);
  }
}

function validateDatabaseUrlConsistency(env: NodeJS.ProcessEnv): void {
  const raw = String(env.DATABASE_URL || '').trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail('DATABASE_URL 不是合法 URL');
  }

  if (parsed.protocol !== 'mysql:') {
    fail(`DATABASE_URL 协议必须为 mysql:，当前为 ${parsed.protocol || '(empty)'}`);
  }

  const expectedHost = String(env.DB_HOST || '').trim();
  if (expectedHost && parsed.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
    fail(`DATABASE_URL host 与 DB_HOST 不一致: url=${parsed.hostname || '(empty)'} DB_HOST=${expectedHost}`);
  }

  const actualPort = parsed.port || '3306';
  const expectedPort = String(env.DB_PORT || '3306').trim() || '3306';
  if (actualPort !== expectedPort) {
    fail(`DATABASE_URL port 与 DB_PORT 不一致: url=${actualPort} DB_PORT=${expectedPort}`);
  }

  const actualDatabase = decodeDatabaseUrlPart(parsed.pathname.replace(/^\/+/, ''), '数据库名');
  const expectedDatabase = String(env.DB_NAME || '').trim();
  if (expectedDatabase && actualDatabase !== expectedDatabase) {
    fail(`DATABASE_URL 数据库名与 DB_NAME 不一致: url=${actualDatabase || '(empty)'} DB_NAME=${expectedDatabase}`);
  }

  const actualUser = decodeDatabaseUrlPart(parsed.username, '用户名');
  const expectedUser = String(env.DB_USER || '').trim();
  if (expectedUser && actualUser !== expectedUser) {
    fail(`DATABASE_URL 用户名与 DB_USER 不一致: url=${actualUser || '(empty)'} DB_USER=${expectedUser}`);
  }

  const expectedPassword = String(env.DB_PASSWORD || '');
  if (expectedPassword) {
    const actualPassword = decodeDatabaseUrlPart(parsed.password, '密码');
    if (actualPassword !== expectedPassword) {
      fail('DATABASE_URL 密码与 DB_PASSWORD 不一致');
    }
  }
}

function normalizeCertificateSerial(serial: string): string {
  const normalized = String(serial || '')
    .trim()
    .toUpperCase()
    .replace(/^0X/, '')
    .replace(/[^0-9A-F]/g, '')
    .replace(/^0+(?=[0-9A-F])/, '');
  return normalized;
}

function requireCanonicalSerial(serial: string, label: string): string {
  const value = String(serial || '').trim();
  if (!value || !CANONICAL_CERT_SERIAL.test(value)) {
    fail(`${label} 必须使用大写十六进制且不能包含 0x、冒号、空格或其他分隔符`);
  }
  const normalized = normalizeCertificateSerial(value);
  if (value !== normalized) {
    fail(`${label} 不是 canonical 证书序列号: configured=${value}, canonical=${normalized}`);
  }
  return normalized;
}

function readTextFile(path: string, label: string): string {
  try {
    const content = fs.readFileSync(path, 'utf8');
    if (!content.trim()) fail(`${label} 文件为空: ${path}`);
    return content;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('生产配置预检失败:')) throw error;
    fail(`${label} 文件不可读: ${path}`);
  }
}

function validateMerchantPrivateKey(path: string): void {
  const pem = readTextFile(path, '微信支付商户私钥');
  try {
    const key = createPrivateKey(pem);
    if (key.type !== 'private' || key.asymmetricKeyType !== 'rsa') {
      fail(`WECHAT_PRIVATE_KEY_PATH 必须是 RSA 私钥: ${path}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('生产配置预检失败:')) throw error;
    fail(`WECHAT_PRIVATE_KEY_PATH 不是可解析的 RSA 私钥: ${path}`);
  }
}

function validatePlatformCertificate(path: string, configuredSerial: string, label: string): void {
  const pem = readTextFile(path, label);
  let certificate: X509Certificate;
  try {
    certificate = new X509Certificate(pem);
  } catch {
    fail(`${label} 不是可解析的 X.509 证书: ${path}`);
  }

  if (certificate.publicKey.asymmetricKeyType !== 'rsa') {
    fail(`${label} 必须使用 RSA 公钥: ${path}`);
  }

  const canonicalConfiguredSerial = requireCanonicalSerial(configuredSerial, `${label}序列号`);
  const actualSerial = normalizeCertificateSerial(certificate.serialNumber);
  if (!actualSerial || canonicalConfiguredSerial !== actualSerial) {
    fail(`${label}序列号与证书不匹配: configured=${canonicalConfiguredSerial}, actual=${actualSerial || 'unknown'}`);
  }

  const validFrom = Date.parse(certificate.validFrom);
  const validTo = Date.parse(certificate.validTo);
  const now = Date.now();
  if (!Number.isFinite(validFrom) || !Number.isFinite(validTo)) {
    fail(`${label}有效期无法解析: ${path}`);
  }
  if (now < validFrom) {
    fail(`${label}尚未生效: validFrom=${certificate.validFrom}`);
  }
  if (validTo - now < MIN_PLATFORM_CERT_VALIDITY_MS) {
    fail(`${label}已过期或将在 24 小时内过期: validTo=${certificate.validTo}`);
  }
}

function validatePlatformCertificateMap(raw: string | undefined): void {
  const value = String(raw || '').trim();
  if (!value) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail('WECHAT_PLATFORM_CERT_MAP 必须是合法 JSON 对象');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('WECHAT_PLATFORM_CERT_MAP 必须是 {"SERIAL":"/path/to/cert.pem"} 形式的 JSON 对象');
  }

  for (const [serial, filePath] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      fail(`WECHAT_PLATFORM_CERT_MAP 中 ${serial || '(empty serial)'} 的证书路径无效`);
    }
    validatePlatformCertificate(filePath.trim(), serial, `微信支付轮换平台证书(${serial})`);
  }
}

function validateOptionalHttpsUrl(value: string | undefined, label: string): void {
  const raw = String(value || '').trim();
  if (!raw) return;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`${label} 不是合法 URL`);
  }
  if (parsed.protocol !== 'https:') {
    fail(`${label} 在生产环境必须使用 HTTPS`);
  }
  if (parsed.username || parsed.password) {
    fail(`${label} 不允许在 URL 中内嵌用户名或密码`);
  }
}

/**
 * Validate production configuration without opening database/Redis connections or starting
 * Nest schedulers. This is intentionally safe to run before a live database migration.
 *
 * It reuses the exact runtime EnvValidator and PaymentService constructor checks, then adds
 * offline-verifiable cryptographic identity checks that the runtime otherwise cannot safely
 * defer until the first real payment/callback.
 */
export function runProductionConfigPreflight(env: NodeJS.ProcessEnv = process.env): void {
  validateEnv({ ...env });

  if ((env.NODE_ENV || 'development') !== 'production') {
    return;
  }

  rejectObviousPlaceholderValues(env);
  validateDatabaseUrlConsistency(env);

  // This value is consumed by every Axios-based external integration. Validate it here so an
  // invalid production setting cannot survive until after a live Prisma migration or until Nest
  // providers have already connected to MySQL/Redis. The mutation of axios.defaults is harmless
  // in the standalone preflight process and is reused directly when preflight runs in main.ts.
  configureOutboundHttpTimeout(env.OUTBOUND_HTTP_TIMEOUT_MS);

  validateMerchantPrivateKey(String(env.WECHAT_PRIVATE_KEY_PATH || ''));
  validatePlatformCertificate(
    String(env.WECHAT_PLATFORM_CERT_PATH || ''),
    String(env.WECHAT_PLATFORM_CERT_SERIAL_NO || ''),
    '微信支付平台证书',
  );
  validatePlatformCertificateMap(env.WECHAT_PLATFORM_CERT_MAP);
  validateOptionalHttpsUrl(env.ALERT_WEBHOOK_URL, 'ALERT_WEBHOOK_URL');

  const configService = {
    get<T = any>(key: string, defaultValue?: T): T | undefined {
      const value = env[key];
      return (value === undefined ? defaultValue : value) as T | undefined;
    },
  } as ConfigService;

  // PaymentService performs the remaining production payment checks. Its other dependencies
  // are not accessed by the constructor, so null placeholders keep this preflight free of
  // database, Redis, HTTP, cron or other runtime side effects.
  new PaymentService(
    null as any,
    configService,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
  );
}

if (require.main === module) {
  runProductionConfigPreflight();
  process.stdout.write('PRODUCTION_CONFIG_PREFLIGHT_PASS\n');
}

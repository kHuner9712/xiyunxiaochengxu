import 'reflect-metadata';
import type { ConfigService } from '@nestjs/config';
import { PaymentService } from '../payment/payment.service';
import { validateEnv } from './env.validation';

/**
 * Validate production configuration without opening database/Redis connections or starting
 * Nest schedulers. This is intentionally safe to run before a live database migration.
 *
 * It reuses the exact runtime EnvValidator and PaymentService constructor checks so deployment
 * cannot drift into a second, weaker set of configuration rules.
 */
export function runProductionConfigPreflight(env: NodeJS.ProcessEnv = process.env): void {
  validateEnv({ ...env });

  if ((env.NODE_ENV || 'development') !== 'production') {
    return;
  }

  const configService = {
    get<T = any>(key: string, defaultValue?: T): T | undefined {
      const value = env[key];
      return (value === undefined ? defaultValue : value) as T | undefined;
    },
  } as ConfigService;

  // PaymentService performs additional production checks beyond validateEnv, including
  // actually reading the merchant private key and WeChat platform certificate contents.
  // Its other dependencies are not accessed by the constructor, so null placeholders keep
  // this preflight free of database, Redis, HTTP, cron or other runtime side effects.
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

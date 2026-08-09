import { BadRequestException } from '@nestjs/common';

export const MAX_SIGNED_BIGINT = 9223372036854775807n;
export const POSITIVE_BIGINT_ID_PATTERN = /^[1-9]\d*$/;

export function parsePositiveBigIntId(
  value: string | number | bigint | null | undefined,
  label: string,
): bigint {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new BadRequestException(`${label}ID无效`);
  }

  const normalized = String(value ?? '').trim();
  if (!POSITIVE_BIGINT_ID_PATTERN.test(normalized)) {
    throw new BadRequestException(`${label}ID无效`);
  }

  const parsed = BigInt(normalized);
  if (parsed > MAX_SIGNED_BIGINT) {
    throw new BadRequestException(`${label}ID超出范围`);
  }
  return parsed;
}

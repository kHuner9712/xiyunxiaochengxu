import { BadRequestException } from '@nestjs/common';
import axios from 'axios';

export const DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS = 10_000;
export const MIN_OUTBOUND_HTTP_TIMEOUT_MS = 1_000;
export const MAX_OUTBOUND_HTTP_TIMEOUT_MS = 60_000;

export function configureOutboundHttpTimeout(rawValue?: string | number | null): number {
  const raw = rawValue ?? DEFAULT_OUTBOUND_HTTP_TIMEOUT_MS;
  const timeoutMs = Number(raw);
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs < MIN_OUTBOUND_HTTP_TIMEOUT_MS ||
    timeoutMs > MAX_OUTBOUND_HTTP_TIMEOUT_MS
  ) {
    throw new BadRequestException(
      `OUTBOUND_HTTP_TIMEOUT_MS 必须是 ${MIN_OUTBOUND_HTTP_TIMEOUT_MS}-${MAX_OUTBOUND_HTTP_TIMEOUT_MS} 之间的整数毫秒值`,
    );
  }

  axios.defaults.timeout = timeoutMs;
  return timeoutMs;
}

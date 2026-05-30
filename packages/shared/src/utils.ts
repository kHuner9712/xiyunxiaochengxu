import * as crypto from 'crypto';

function formatTimestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

function secureRandomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function toFen(yuan: number): number {
  return Math.round(yuan * 100);
}

export function toYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

export function formatPrice(fen: number): string {
  return (fen / 100).toFixed(2);
}

export function generateOrderNo(): string {
  return `XY${formatTimestamp()}${secureRandomHex(3)}`;
}

export function generateAftersaleNo(): string {
  return `AS${formatTimestamp()}${secureRandomHex(3)}`;
}

export function generatePaymentNo(): string {
  return `PAY${formatTimestamp()}${secureRandomHex(3)}`;
}

export function generateRefundNo(): string {
  return `REFUND${formatTimestamp()}${secureRandomHex(3)}`;
}

export function calculateBabyMonthAge(birthday: string | Date): number {
  const birth = new Date(birthday);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

export function getMemberLevelByGrowth(growthValue: number): number {
  if (growthValue >= 20000) return 3;
  if (growthValue >= 5000) return 2;
  if (growthValue >= 1000) return 1;
  return 0;
}

export function paginate<T>(list: T[], total: number, page: number, pageSize: number) {
  return {
    list,
    total,
    page,
    pageSize,
  };
}

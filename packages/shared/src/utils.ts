export function toFen(yuan: number): number {
  return Math.round(yuan * 100);
}

export function toYuan(fen: number): number {
  return fen / 100;
}

export function formatPrice(fen: number): string {
  return (fen / 100).toFixed(2);
}

export function generateOrderNo(): string {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `XY${ts}${rand}`;
}

export function generateAftersaleNo(): string {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `AS${ts}${rand}`;
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

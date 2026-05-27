// Helpers de precisão monetária. Padronizar arredondamento half-away-from-zero a 2 casas.
export function round2(n: number | string | null | undefined): number {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function sumMoney<T>(items: T[] | null | undefined, fn: (t: T) => number | string | null | undefined): number {
  const total = (items ?? []).reduce((acc, t) => acc + Number(fn(t) ?? 0), 0);
  return round2(total);
}

export function round4(n: number | string | null | undefined): number {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 10000) / 10000;
}

import { byId } from '@/data/catalog';

export const MIN_MONTHS = 1;
export const MAX_MONTHS = 12;

const TIERS = [
  { min: 12, rate: 0.2 },
  { min: 6, rate: 0.15 },
  { min: 3, rate: 0.1 },
  { min: 1, rate: 0 },
];

export const discountFor = (months: number) =>
  TIERS.find((t) => months >= t.min)?.rate ?? 0;

export type Quote = {
  lines: { id: string; name: string; monthly: number }[];
  subtotal: number;
  discount: number;
  monthly: number;
  deposit: number;
  dueToday: number;
  months: number;
};

/**
 * Single pricing authority: the summary panel and the Stripe route both call
 * this, so the displayed total and the charged total cannot drift.
 * Money is rounded to whole cents at each step.
 */
export function quote(ids: string[], months: number): Quote {
  const m = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, Math.round(months)));

  const lines = ids
    .map(byId)
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .map((i) => ({ id: i.id, name: i.name, monthly: i.monthly }));

  const subtotal = lines.reduce((s, l) => s + l.monthly, 0);
  const discount = discountFor(m);
  const monthly = round2(subtotal * (1 - discount));
  const deposit = monthly; // one month, refundable

  return {
    lines,
    subtotal,
    discount,
    monthly,
    deposit,
    dueToday: round2(monthly + deposit),
    months: m,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const toCents = (n: number) => Math.round(n * 100);

export const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

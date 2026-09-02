/**
 * Canonical money contract — Phase 5
 *
 * Settlement currency is XAF only. amountMinor is whole XAF (no fractional unit).
 * Do not use JavaScript Number for authoritative arithmetic on large values.
 */

export const SETTLEMENT_CURRENCY = 'XAF' as const;

export type SettlementCurrency = typeof SETTLEMENT_CURRENCY;

/** Authoritative money representation at application boundaries. */
export type Money = {
  readonly currency: SettlementCurrency;
  readonly amountMinor: bigint;
};

export type MoneyLike = {
  amount_minor?: number | string | bigint | null;
  amount_cfa?: number | string | null;
  amount?: number | string | null;
  currency?: string | null;
};

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** Build canonical XAF money from a minor-unit integer. */
export function xafMoney(amountMinor: bigint | number | string): Money {
  const minor = toBigIntMinor(amountMinor);
  if (minor < 0n) {
    throw new Error('xafMoney: amountMinor must be non-negative');
  }
  return { currency: SETTLEMENT_CURRENCY, amountMinor: minor };
}

/**
 * Digits-only string from a typed amount (commas, spaces, dots stripped).
 * XAF has no fractional unit, so "62,000.50" becomes "62000".
 */
export function xafDigitsFromInput(raw: string): string {
  const stripped = String(raw)
    .replace(/[\s\u00a0\u202f']/g, '')
    .replace(/,/g, '');
  const negative = stripped.trim().startsWith('-');
  const [whole = ''] = stripped.replace(/-/g, '').split('.');
  const digits = whole.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');
  if (!digits) return '';
  return negative ? `-${digits}` : digits;
}

/** Parse a user-typed or DB amount into whole XAF. Empty → 0. */
export function parseXafInput(raw: string): bigint {
  const digits = xafDigitsFromInput(raw);
  if (!digits || digits === '-') return 0n;
  return BigInt(digits);
}

/** Grouped display for a typed field ("62000" → "62 000"). Uses regular spaces so the keypad stays usable. */
export function formatXafInput(raw: string): string {
  const digits = xafDigitsFromInput(raw);
  if (!digits) return '';
  const negative = digits.startsWith('-');
  const abs = negative ? digits.slice(1) : digits;
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return negative ? `-${grouped}` : grouped;
}

/** Parse DB/API values to bigint minor units (truncates toward zero). */
export function toBigIntMinor(value: bigint | number | string | null | undefined): bigint {
  if (value === null || value === undefined || value === '') {
    return 0n;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('toBigIntMinor: non-finite number');
    }
    return BigInt(Math.trunc(value));
  }
  try {
    return parseXafInput(String(value));
  } catch {
    throw new Error(`toBigIntMinor: expected integer string, got ${value}`);
  }
}

/**
 * Resolve milestone/workflow amount to canonical minor units.
 * Precedence: amount_minor > amount_cfa > amount (legacy).
 */
export function resolveAmountMinor(row: MoneyLike): bigint {
  if (row.amount_minor != null && row.amount_minor !== '') {
    return toBigIntMinor(row.amount_minor);
  }
  if (row.amount_cfa != null && row.amount_cfa !== '') {
    return toBigIntMinor(row.amount_cfa);
  }
  if (row.amount != null && row.amount !== '') {
    return toBigIntMinor(row.amount);
  }
  return 0n;
}

/** Insurance/platform fee at 1.5% (150 bps), integer truncate toward zero. Matches DB platform_fee_insurance_minor. */
export function insuranceFeeMinor(grossMinor: bigint): bigint {
  if (grossMinor < 0n) {
    throw new Error('insuranceFeeMinor: gross must be non-negative');
  }
  return (grossMinor * 15n) / 1000n;
}

/** Generic basis-points fee on integer minor units (truncate toward zero). */
export function feeBpsMinor(amountMinor: bigint, basisPoints: number): bigint {
  if (amountMinor < 0n) {
    throw new Error('feeBpsMinor: amount must be non-negative');
  }
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new Error('feeBpsMinor: basisPoints must be a non-negative integer');
  }
  return (amountMinor * BigInt(basisPoints)) / 10000n;
}

/** Format whole XAF for display (no fractional digits). */
export function formatXafMinor(amountMinor: bigint): string {
  return amountMinor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

/** Serialize for JSON/API (string avoids JS Number precision loss). */
export function moneyToJson(m: Money): { currency: SettlementCurrency; amount_minor: string } {
  return { currency: m.currency, amount_minor: m.amountMinor.toString() };
}

/** Row shape for Supabase insert/update of canonical workflow amounts. */
export function moneyToRow(m: Money): { currency: SettlementCurrency; amount_minor: string } {
  if (m.amountMinor > MAX_SAFE) {
    return { currency: m.currency, amount_minor: m.amountMinor.toString() };
  }
  return { currency: m.currency, amount_minor: m.amountMinor.toString() };
}

/** Resolve project planning budget from canonical or legacy columns. */
export function resolveProjectBudgetMinor(row: {
  estimated_budget_minor?: number | string | bigint | null;
  budget?: number | string | null;
}): bigint {
  if (row.estimated_budget_minor != null && row.estimated_budget_minor !== '') {
    return toBigIntMinor(row.estimated_budget_minor);
  }
  if (row.budget != null && row.budget !== '') {
    return toBigIntMinor(row.budget);
  }
  return 0n;
}

export function formatBudgetDisplay(minor: bigint): string {
  return `${formatXafMinor(minor)} CFA`;
}

/** @deprecated Migrate callers to ledger read model (Phase 39). */
export function sumLegacyTransactionAmounts(
  rows: Array<{ amount?: number | string | null }>,
): bigint {
  return rows.reduce((acc, row) => acc + toBigIntMinor(row.amount ?? 0), 0n);
}

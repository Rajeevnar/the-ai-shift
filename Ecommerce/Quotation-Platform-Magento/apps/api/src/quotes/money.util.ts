// Rounds to 2 decimal places using normal (not banker's) rounding — matches
// how a quote/invoice total is expected to look, and how Postgres's own
// Decimal(12,2) columns will store the value anyway.
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

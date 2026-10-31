/** Exact half-away-from-zero rounding shared by campaign economics and fee calculations. */
export function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError('Positive denominator required');
  return numerator < 0n
    ? -((-numerator + denominator / 2n) / denominator)
    : (numerator + denominator / 2n) / denominator;
}

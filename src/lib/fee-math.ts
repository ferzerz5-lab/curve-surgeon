import type { FeeConfig } from "./types";

const FEE_DENOMINATOR = 1_000_000_000;

export interface FeeBreakdown {
  totalFeeNumerator: number;
  totalFeeAmount: number;
  protocolFee: number; // 20% of total fee
  referralFee: number; // 20% of protocol fee, if a referrer is present
  partnerFee: number;
  creatorFee: number;
}

/**
 * Resolves the effective fee numerator for a trade, accounting for:
 *  - a time-based fee scheduler (high fee at launch, decaying to a floor)
 *  - a rate limiter (extra fee above a quote-size threshold, to punish snipers)
 *
 * secondsSinceActivation: how long the pool has been live when this trade lands.
 * quoteAmount: size of this specific swap, used against the rate limiter.
 */
export function resolveEffectiveFeeNumerator(
  fees: FeeConfig,
  secondsSinceActivation: number,
  quoteAmount: number
): number {
  let numerator = fees.baseFeeNumerator;

  if (
    fees.schedulerStartFeeNumerator !== undefined &&
    fees.schedulerEndFeeNumerator !== undefined &&
    fees.schedulerDecaySeconds !== undefined &&
    fees.schedulerDecaySeconds > 0
  ) {
    const progress = Math.min(1, secondsSinceActivation / fees.schedulerDecaySeconds);
    numerator =
      fees.schedulerStartFeeNumerator +
      (fees.schedulerEndFeeNumerator - fees.schedulerStartFeeNumerator) * progress;
  }

  if (
    fees.rateLimiterThresholdQuote !== undefined &&
    fees.rateLimiterExtraFeeNumerator !== undefined &&
    quoteAmount > fees.rateLimiterThresholdQuote
  ) {
    numerator += fees.rateLimiterExtraFeeNumerator;
  }

  return numerator;
}

export function computeFeeBreakdown(
  fees: FeeConfig,
  effectiveFeeNumerator: number,
  quoteAmount: number,
  hasReferrer: boolean
): FeeBreakdown {
  const totalFeeAmount = (quoteAmount * effectiveFeeNumerator) / FEE_DENOMINATOR;
  const protocolFee = totalFeeAmount * 0.2;
  const referralFee = hasReferrer ? protocolFee * 0.2 : 0;
  const remainderAfterProtocol = totalFeeAmount - protocolFee;
  const creatorFee = remainderAfterProtocol * fees.creatorTradingFeePercentage;
  const partnerFee = remainderAfterProtocol - creatorFee;

  return {
    totalFeeNumerator: effectiveFeeNumerator,
    totalFeeAmount,
    protocolFee,
    referralFee,
    partnerFee,
    creatorFee,
  };
}

export function numeratorToPercent(numerator: number): number {
  return (numerator / FEE_DENOMINATOR) * 100;
}

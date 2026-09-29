import type { PoolConfigDraft } from "./types";

/**
 * A deliberately naive config: thin early liquidity (steep first segment),
 * no anti-sniper fee mechanism, and unlocked LP percentages that violate the
 * 10% day-1 lock minimum. Curve capacity is sized close to the migration
 * threshold, as a real config would be. Representative of a "just get
 * something on-chain fast" launch a first-time builder might reach for.
 */
export const riskyConfig: PoolConfigDraft = {
  name: "Naive Meme Launch (unaudited)",
  quoteMint: "SOL",
  sqrtPriceStart: 1,
  segments: [
    { sqrtPriceUpper: 1.8, liquidity: 8 },  // thin early liquidity: 8*(1.8-1)=6.4 quote
    { sqrtPriceUpper: 2.2, liquidity: 9 },  // 9*(2.2-1.8)=3.6 quote -- total capacity 10.0, matches threshold
  ],
  fees: {
    baseFeeNumerator: 2_500_000, // 0.25%
    creatorTradingFeePercentage: 0.2,
    // no scheduler, no rate limiter configured
  },
  migration: {
    migrationQuoteThreshold: 10, // 10 SOL
    lockedLpPercentageDay1: 0.05, // below the 10% protocol minimum
    partnerLpPercentage: 0.6,
    creatorLpPercentage: 0.35,
  },
  supplyMode: "dynamic",
};

/**
 * A sounder config: deeper early liquidity to blunt whale impact, a fee
 * scheduler + rate limiter to deter snipers, curve capacity sized closely to
 * the actual migration threshold (minimal stranded supply), and LP
 * percentages that satisfy the lock minimum.
 */
export const soundConfig: PoolConfigDraft = {
  name: "Hardened Launch (audited)",
  quoteMint: "SOL",
  sqrtPriceStart: 1,
  segments: [
    { sqrtPriceUpper: 1.15, liquidity: 26 }, // deep early liquidity blunts whale impact
    { sqrtPriceUpper: 1.35, liquidity: 20 },
    { sqrtPriceUpper: 1.55, liquidity: 15 }, // sized so total capacity ~= threshold
  ],
  fees: {
    baseFeeNumerator: 2_500_000,
    schedulerStartFeeNumerator: 50_000_000, // 5% at t=0
    schedulerEndFeeNumerator: 2_500_000, // decays to 0.25%
    schedulerDecaySeconds: 300, // 5 minutes
    rateLimiterThresholdQuote: 1, // >1 SOL per swap triggers extra fee
    rateLimiterExtraFeeNumerator: 20_000_000, // +2%
    creatorTradingFeePercentage: 0.2,
  },
  migration: {
    migrationQuoteThreshold: 10,
    lockedLpPercentageDay1: 0.15,
    partnerLpPercentage: 0.5,
    creatorLpPercentage: 0.35,
  },
  supplyMode: "dynamic",
};

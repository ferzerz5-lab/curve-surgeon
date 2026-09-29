/**
 * Core types modeling a Meteora DBC PoolConfig for simulation purposes.
 *
 * NOTE ON PRECISION: The real on-chain program stores sqrt_price and liquidity
 * as u128 fixed-point (Q64.64) values via BN.js in the actual SDK. For the
 * off-chain simulator we work in plain `number` (floating point) because we
 * only need directional/relative accuracy to catch bad configs, not
 * lamport-exact precision. Before wiring this into a real devnet deployment
 * (see scripts/run-scenarios.ts), swap these for BN-based conversions using
 * the real SDK's `getSqrtPriceFromPrice` / curve helpers so the numbers you
 * show in the demo are backed by the same math the program actually runs.
 */

export interface CurveSegment {
  /** Upper bound sqrt(price) of this segment */
  sqrtPriceUpper: number;
  /** Virtual liquidity active across this segment */
  liquidity: number;
}

export interface FeeConfig {
  /** Base trading fee, numerator over 1_000_000_000 (e.g. 2_500_000 = 0.25%) */
  baseFeeNumerator: number;
  /** Optional: fee numerator at t=0 if a time-based fee scheduler is used */
  schedulerStartFeeNumerator?: number;
  /** Optional: fee numerator once the scheduler has fully decayed */
  schedulerEndFeeNumerator?: number;
  /** Optional: seconds for the fee scheduler to decay from start to end */
  schedulerDecaySeconds?: number;
  /** Optional: rate limiter — extra fee numerator applied per unit above a size threshold */
  rateLimiterThresholdQuote?: number;
  rateLimiterExtraFeeNumerator?: number;
  /** Share of the 80% non-protocol fee that goes to the creator (0-1) */
  creatorTradingFeePercentage: number;
}

export interface MigrationConfig {
  /** Quote reserve (in quote token, e.g. SOL) required to trigger migration */
  migrationQuoteThreshold: number;
  /** Fraction of LP that must be locked at day 1 post-migration (protocol minimum: 0.10) */
  lockedLpPercentageDay1: number;
  /** Fraction of LP the partner can claim immediately (unlocked) */
  partnerLpPercentage: number;
  /** Fraction of LP the creator can claim immediately (unlocked) */
  creatorLpPercentage: number;
}

export interface PoolConfigDraft {
  name: string;
  quoteMint: "SOL" | "USDC" | "JUP" | string;
  /** sqrt(price) at pool activation, i.e. the lower bound of segment 0 */
  sqrtPriceStart: number;
  segments: CurveSegment[]; // ordered, low price -> high price, max 16
  fees: FeeConfig;
  migration: MigrationConfig;
  /** Fixed supply (all pre-minted) vs dynamic supply (minted on buy) */
  supplyMode: "fixed" | "dynamic";
}

export interface ScenarioResult {
  scenarioName: string;
  passed: boolean;
  severity: "info" | "warning" | "critical";
  headline: string; // one-line, dollar/percent terms summary for the scorecard
  detail: string;
  numbers: Record<string, number>;
}

export interface ScorecardReport {
  configName: string;
  results: ScenarioResult[];
  overallVerdict: "safe" | "risky" | "unsafe";
}

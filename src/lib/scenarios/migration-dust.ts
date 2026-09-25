import type { PoolConfigDraft, ScenarioResult } from "../types";
import { segmentsToBounds, totalBaseSold, simulateBuy } from "../curve-math";

/**
 * CURVE SIZING / STRANDED SUPPLY
 *
 * A DBC curve is configured with segments whose combined quote capacity is
 * meant to line up with `migrationQuoteThreshold` -- i.e. the curve should be
 * "full" right around when migration triggers. This scenario simulates a buy
 * of exactly the migration threshold and checks how much of the curve's
 * configured base-token capacity is left over beyond that point. A large
 * leftover means segments were sized too generously relative to the actual
 * raise target -- that base-token capacity was configured but will never be
 * sold on the curve, which either strands supply or requires manual handling
 * at migration.
 *
 * HONEST CAVEAT: this operates in floating point on the documented segment
 * formulas, so it will not exactly reproduce the on-chain program's u128
 * fixed-point integer-division rounding (the source of true per-swap "dust"
 * from a partial fill). It answers a related, higher-leverage question for a
 * builder configuring a curve: "did I size my segments sanely relative to my
 * raise target?" -- catching a curve that's off by a large margin. For
 * lamport-exact dust prediction, wire this up to the real SDK's on-chain
 * quote simulation before relying on it for anything beyond directional
 * sanity-checking.
 */
export function runMigrationDustScenario(config: PoolConfigDraft): ScenarioResult {
  const bounds = segmentsToBounds(config.sqrtPriceStart, config.segments);
  const threshold = config.migration.migrationQuoteThreshold;
  const totalCurveBaseCapacity = totalBaseSold(bounds);

  const { baseOut: baseSoldAtMigration } = simulateBuy(bounds, config.sqrtPriceStart, threshold);
  const strandedBase = Math.max(0, totalCurveBaseCapacity - baseSoldAtMigration);
  const strandedPct = totalCurveBaseCapacity > 0 ? (strandedBase / totalCurveBaseCapacity) * 100 : 0;

  let severity: ScenarioResult["severity"] = "info";
  if (strandedPct > 15) severity = "warning";
  if (strandedPct > 40) severity = "critical";

  const passed = severity !== "critical";

  return {
    scenarioName: "Curve Sizing / Stranded Supply",
    passed,
    severity,
    headline: `${strandedPct.toFixed(1)}% of configured base-token capacity sits beyond the migration point and will never sell on the curve`,
    detail:
      severity === "critical"
        ? "Segments are sized far beyond what's needed to hit the migration threshold. This much unsold capacity typically means later segments should be removed or the threshold raised to match -- otherwise that supply needs manual handling (e.g. burn) at migration."
        : severity === "warning"
        ? "There's a moderate amount of curve capacity beyond the migration point -- worth double-checking the segments were sized intentionally."
        : "Curve capacity is sized closely to the migration threshold, as intended.",
    numbers: {
      thresholdQuote: threshold,
      totalCurveBaseCapacity,
      baseSoldAtMigration,
      strandedBase,
      strandedPct,
    },
  };
}

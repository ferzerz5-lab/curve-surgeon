import type { PoolConfigDraft, ScenarioResult } from "../types";
import { segmentsToBounds, simulateBuy, spotPrice } from "../curve-math";

/**
 * WHALE IMPACT: simulates one large single-transaction buy landing early on
 * the curve (right at launch) and reports the price impact relative to the
 * fair/average price a smaller retail buyer would pay for the same total
 * migration. A config where a moderate quote amount can move price by a huge
 * multiple in one tx is a config that's trivially exploitable by one wallet.
 *
 * whaleBuyFraction: the whale's buy sized as a fraction of the full
 * migration_quote_threshold (e.g. 0.1 = a buy worth 10% of the total raise).
 */
export function runWhaleImpactScenario(
  config: PoolConfigDraft,
  whaleBuyFraction: number = 0.1
): ScenarioResult {
  const sqrtPriceStart = config.sqrtPriceStart;
  const bounds = segmentsToBounds(sqrtPriceStart, config.segments);
  const totalMigrateQuote = config.migration.migrationQuoteThreshold;
  const whaleQuoteIn = totalMigrateQuote * whaleBuyFraction;

  const startPrice = spotPrice(sqrtPriceStart);
  const { newSqrtPrice, avgExecutionPrice } = simulateBuy(bounds, sqrtPriceStart, whaleQuoteIn);
  const endPrice = spotPrice(newSqrtPrice);

  const priceImpactPct = ((endPrice - startPrice) / startPrice) * 100;
  const fairAvgPrice = totalMigrateQuote / (bounds.reduce((s, b) => s + (b.liquidity * (1 / b.sqrtPriceLower - 1 / b.sqrtPriceUpper)), 0) || 1);
  const overpayVsFairPct = fairAvgPrice > 0 ? ((avgExecutionPrice - fairAvgPrice) / fairAvgPrice) * 100 : 0;

  // Thresholds are deliberately conservative and documented so they can be
  // tuned per-vertical (a meme launch tolerates more volatility than a
  // treasury-grade launch).
  let severity: ScenarioResult["severity"] = "info";
  if (priceImpactPct > 50) severity = "warning";
  if (priceImpactPct > 150) severity = "critical";

  const passed = severity !== "critical";

  return {
    scenarioName: "Whale Impact",
    passed,
    severity,
    headline: `A single buy worth ${(whaleBuyFraction * 100).toFixed(0)}% of the raise moves price ${priceImpactPct.toFixed(0)}%`,
    detail:
      severity === "critical"
        ? `This curve lets one wallet move price by ${priceImpactPct.toFixed(0)}% in a single transaction. Early segments are too thin — consider adding more liquidity to the first 1-2 segments to blunt single-buyer dominance.`
        : `Price impact from a whale-sized buy is within a tolerable range for this curve shape.`,
    numbers: {
      whaleQuoteIn,
      startPrice,
      endPrice,
      priceImpactPct,
      avgExecutionPrice,
      fairAvgPrice,
      overpayVsFairPct,
    },
  };
}

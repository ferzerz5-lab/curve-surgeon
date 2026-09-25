import type { PoolConfigDraft, ScenarioResult } from "../types";
import { segmentsToBounds, simulateBuy } from "../curve-math";
import { resolveEffectiveFeeNumerator, computeFeeBreakdown, numeratorToPercent } from "../fee-math";

/**
 * SNIPER STRESS TEST: simulates a bot buying immediately at pool activation
 * (secondsSinceActivation = 0) with a large, rate-limiter-triggering order,
 * and reports how much of that order's cost is actually absorbed by the
 * configured anti-sniper fee (time scheduler + rate limiter) vs. how much
 * cheap supply the sniper still walks away with.
 *
 * The check: if the effective fee at t=0 is barely higher than the steady
 * -state fee, your anti-sniper config isn't doing its job.
 */
export function runSniperStressScenario(
  config: PoolConfigDraft,
  sniperBuyQuote: number
): ScenarioResult {
  const bounds = segmentsToBounds(config.sqrtPriceStart, config.segments);
  const { baseOut } = simulateBuy(bounds, config.sqrtPriceStart, sniperBuyQuote);

  const feeAtLaunch = resolveEffectiveFeeNumerator(config.fees, 0, sniperBuyQuote);
  const feeSteadyState = resolveEffectiveFeeNumerator(
    config.fees,
    (config.fees.schedulerDecaySeconds ?? 0) + 1,
    sniperBuyQuote
  );

  const launchBreakdown = computeFeeBreakdown(config.fees, feeAtLaunch, sniperBuyQuote, false);

  const feeDeterrentGapPct = numeratorToPercent(feeAtLaunch) - numeratorToPercent(feeSteadyState);
  const sharesOfSupply = baseOut; // base tokens the sniper walks away with

  const hasAntiSniperConfig =
    config.fees.schedulerStartFeeNumerator !== undefined ||
    config.fees.rateLimiterThresholdQuote !== undefined;

  let severity: ScenarioResult["severity"] = "info";
  if (!hasAntiSniperConfig) severity = "warning";
  if (hasAntiSniperConfig && feeDeterrentGapPct < 1) severity = "warning";
  if (!hasAntiSniperConfig && sniperBuyQuote > config.migration.migrationQuoteThreshold * 0.05) {
    severity = "critical";
  }

  const passed = severity !== "critical";

  return {
    scenarioName: "Sniper Stress Test",
    passed,
    severity,
    headline: hasAntiSniperConfig
      ? `Launch-time fee is ${feeDeterrentGapPct.toFixed(2)}pp higher than steady state`
      : `No fee scheduler or rate limiter configured — first-block buys pay the same fee as everyone else`,
    detail: !hasAntiSniperConfig
      ? "This config has no anti-sniper mechanism. A bot buying in the first block pays identical fees to a retail trader hours later, and can accumulate a large share of early, cheap supply with no additional cost."
      : feeDeterrentGapPct < 1
      ? "A fee scheduler or rate limiter is configured, but the deterrent gap between launch-time and steady-state fees is small enough that it likely won't change sniper behavior."
      : "Anti-sniper fee configuration meaningfully raises the cost of buying immediately at launch.",
    numbers: {
      sniperBuyQuote,
      baseTokensAcquired: baseOut,
      feeAtLaunchPct: numeratorToPercent(feeAtLaunch),
      feeSteadyStatePct: numeratorToPercent(feeSteadyState),
      feeDeterrentGapPct,
      launchFeeCost: launchBreakdown.totalFeeAmount,
    },
  };
}

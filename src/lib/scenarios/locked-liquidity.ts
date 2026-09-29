import type { PoolConfigDraft, ScenarioResult } from "../types";

const PROTOCOL_MIN_LOCKED_DAY1 = 0.10; // Meteora's documented hard minimum

/**
 * LOCKED LIQUIDITY COMPLIANCE: DBC enforces that at least 10% of liquidity
 * must remain locked at day 1 (86400s) post-migration, achieved via
 * permanent locked liquidity and/or LP vesting (DAMM v2 only). This is a
 * hard protocol rule, not a suggestion — a config that violates it will
 * simply be rejected on-chain. Catching this before deployment saves a
 * failed transaction and a confused creator.
 */
export function runLockedLiquidityScenario(config: PoolConfigDraft): ScenarioResult {
  const { lockedLpPercentageDay1, partnerLpPercentage, creatorLpPercentage } = config.migration;

  const unlockedTotal = partnerLpPercentage + creatorLpPercentage;
  const impliedLocked = 1 - unlockedTotal;
  const meetsMinimum = lockedLpPercentageDay1 >= PROTOCOL_MIN_LOCKED_DAY1;
  const percentagesConsistent = Math.abs(impliedLocked - lockedLpPercentageDay1) < 0.0001;

  let severity: ScenarioResult["severity"] = "info";
  if (!meetsMinimum) severity = "critical";
  if (meetsMinimum && !percentagesConsistent) severity = "warning";

  const passed = severity !== "critical";

  return {
    scenarioName: "Locked Liquidity Compliance",
    passed,
    severity,
    headline: meetsMinimum
      ? `${(lockedLpPercentageDay1 * 100).toFixed(1)}% locked at day 1 — meets the 10% protocol minimum`
      : `Only ${(lockedLpPercentageDay1 * 100).toFixed(1)}% locked at day 1 — below the protocol's hard 10% minimum`,
    detail: !meetsMinimum
      ? "This config will be rejected on-chain. DBC requires at least 10% of liquidity locked (via permanent lock and/or LP vesting) at day 1 post-migration. Increase locked LP or reduce partner/creator unlocked percentages."
      : !percentagesConsistent
      ? "Locked percentage doesn't reconcile with partner + creator claimable percentages — double check these sum correctly before deploying."
      : "Config satisfies the protocol's minimum locked-liquidity requirement.",
    numbers: {
      lockedLpPercentageDay1,
      partnerLpPercentage,
      creatorLpPercentage,
      impliedLocked,
      protocolMinimum: PROTOCOL_MIN_LOCKED_DAY1,
    },
  };
}

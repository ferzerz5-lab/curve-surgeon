import type { PoolConfigDraft, ScorecardReport, ScenarioResult } from "../types";
import { runWhaleImpactScenario } from "./whale-impact";
import { runSniperStressScenario } from "./sniper-stress";
import { runMigrationDustScenario } from "./migration-dust";
import { runLockedLiquidityScenario } from "./locked-liquidity";

export { runWhaleImpactScenario, runSniperStressScenario, runMigrationDustScenario, runLockedLiquidityScenario };

export function runFullAudit(config: PoolConfigDraft): ScorecardReport {
  const results: ScenarioResult[] = [
    runLockedLiquidityScenario(config),
    runWhaleImpactScenario(config, 0.1),
    runSniperStressScenario(config, config.migration.migrationQuoteThreshold * 0.05),
    runMigrationDustScenario(config),
  ];

  const hasCritical = results.some((r) => r.severity === "critical");
  const hasWarning = results.some((r) => r.severity === "warning");

  const overallVerdict: ScorecardReport["overallVerdict"] = hasCritical
    ? "unsafe"
    : hasWarning
    ? "risky"
    : "safe";

  return {
    configName: config.name,
    results,
    overallVerdict,
  };
}

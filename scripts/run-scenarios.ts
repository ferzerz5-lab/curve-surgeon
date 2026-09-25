import { runFullAudit } from "../src/lib/scenarios/index";
import { riskyConfig, soundConfig } from "../src/lib/example-configs";
import type { ScorecardReport } from "../src/lib/types";

function printReport(report: ScorecardReport) {
  const verdictEmoji = { safe: "✅", risky: "⚠️", unsafe: "🚨" }[report.overallVerdict];
  console.log(`\n${"=".repeat(70)}`);
  console.log(`${verdictEmoji}  ${report.configName} — overall: ${report.overallVerdict.toUpperCase()}`);
  console.log("=".repeat(70));

  for (const r of report.results) {
    const icon = { info: "  ", warning: "⚠️ ", critical: "🚨 " }[r.severity];
    console.log(`\n${icon}${r.scenarioName}`);
    console.log(`   ${r.headline}`);
    console.log(`   ${r.detail}`);
  }
  console.log("");
}

console.log("CURVE SURGEON — DBC pre-launch config auditor\n");
printReport(runFullAudit(riskyConfig));
printReport(runFullAudit(soundConfig));

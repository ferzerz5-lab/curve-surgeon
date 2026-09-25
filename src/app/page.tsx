"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { PoolConfigDraft, ScenarioResult } from "../lib/types";
import { segmentsToBounds, sampleCurveForChart, totalQuoteToMigrate } from "../lib/curve-math";
import { runFullAudit } from "../lib/scenarios";
import { riskyConfig, soundConfig } from "../lib/example-configs";
import { CurveSurgeonMark } from "./logo";

type EditableSegment = { sqrtPriceUpper: number; liquidity: number };

function cloneConfig(c: PoolConfigDraft): PoolConfigDraft {
  return JSON.parse(JSON.stringify(c));
}

const SEVERITY_LABEL: Record<ScenarioResult["severity"], string> = {
  info: "info",
  warning: "warning",
  critical: "critical",
};

export default function Page() {
  const [config, setConfig] = useState<PoolConfigDraft>(() => cloneConfig(riskyConfig));

  const updateSegment = (index: number, patch: Partial<EditableSegment>) => {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      next.segments[index] = { ...next.segments[index], ...patch };
      return next;
    });
  };

  const toggleAntiSniper = (enabled: boolean) => {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      if (enabled) {
        next.fees.schedulerStartFeeNumerator = 50_000_000;
        next.fees.schedulerEndFeeNumerator = next.fees.baseFeeNumerator;
        next.fees.schedulerDecaySeconds = 300;
        next.fees.rateLimiterThresholdQuote = 1;
        next.fees.rateLimiterExtraFeeNumerator = 20_000_000;
      } else {
        delete next.fees.schedulerStartFeeNumerator;
        delete next.fees.schedulerEndFeeNumerator;
        delete next.fees.schedulerDecaySeconds;
        delete next.fees.rateLimiterThresholdQuote;
        delete next.fees.rateLimiterExtraFeeNumerator;
      }
      return next;
    });
  };

  const updateLockedLp = (lockedPct: number) => {
    setConfig((prev) => {
      const next = cloneConfig(prev);
      const unlocked = 1 - lockedPct;
      const ratio =
        next.migration.partnerLpPercentage /
        (next.migration.partnerLpPercentage + next.migration.creatorLpPercentage || 1);
      next.migration.lockedLpPercentageDay1 = lockedPct;
      next.migration.partnerLpPercentage = unlocked * ratio;
      next.migration.creatorLpPercentage = unlocked * (1 - ratio);
      return next;
    });
  };

  const loadPreset = (preset: "risky" | "sound") => {
    setConfig(cloneConfig(preset === "risky" ? riskyConfig : soundConfig));
  };

  const { chartData, report } = useMemo(() => {
    const bounds = segmentsToBounds(config.sqrtPriceStart, config.segments);
    const capacity = totalQuoteToMigrate(bounds);
    const upTo = Math.max(config.migration.migrationQuoteThreshold, capacity) * 1.05;
    const chartData = sampleCurveForChart(bounds, config.sqrtPriceStart, upTo, 60);
    const report = runFullAudit(config);
    return { chartData, report };
  }, [config]);

  const hasAntiSniper = config.fees.schedulerStartFeeNumerator !== undefined;

  return (
    <div className="page">
      <div className="header">
        <div className="brand-row">
          <CurveSurgeonMark />
          <h1>Curve Surgeon</h1>
        </div>
        <p>Pre-launch simulator &amp; auditor for Meteora Dynamic Bonding Curve configs</p>
        <span className="tool-pill">
          <span className="dot" />
          BUILT FOR METEORA DBC
        </span>
      </div>

      <div className="layout">
        <div>
          <div className="panel">
            <h2>Presets</h2>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => loadPreset("risky")} style={presetBtnStyle}>
                Naive config
              </button>
              <button onClick={() => loadPreset("sound")} style={presetBtnStyle}>
                Hardened config
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Curve Segments</h2>
            {config.segments.map((seg, i) => (
              <div className="segment-block" key={i}>
                <div className="segment-title">Segment {i + 1}</div>
                <div className="control-group">
                  <div className="control-label">
                    <span>Upper √price</span>
                    <strong>{seg.sqrtPriceUpper.toFixed(3)}</strong>
                  </div>
                  <input
                    type="range"
                    min={config.sqrtPriceStart + 0.01}
                    max={3}
                    step={0.01}
                    value={seg.sqrtPriceUpper}
                    onChange={(e) => updateSegment(i, { sqrtPriceUpper: Number(e.target.value) })}
                  />
                </div>
                <div className="control-group">
                  <div className="control-label">
                    <span>Liquidity</span>
                    <strong>{seg.liquidity.toFixed(1)}</strong>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={0.5}
                    value={seg.liquidity}
                    onChange={(e) => updateSegment(i, { liquidity: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>Protection &amp; Migration</h2>
            <div className="toggle-row">
              <span>Anti-sniper fee scheduler</span>
              <input
                type="checkbox"
                checked={hasAntiSniper}
                onChange={(e) => toggleAntiSniper(e.target.checked)}
              />
            </div>
            <div className="control-group">
              <div className="control-label">
                <span>Locked LP at day 1</span>
                <strong>{(config.migration.lockedLpPercentageDay1 * 100).toFixed(0)}%</strong>
              </div>
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.01}
                value={config.migration.lockedLpPercentageDay1}
                onChange={(e) => updateLockedLp(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#262b33" strokeDasharray="3 3" />
                <XAxis
                  dataKey="cumulativeQuote"
                  stroke="#8b93a1"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  label={{ value: "Cumulative quote (SOL)", position: "insideBottom", offset: -2, fill: "#8b93a1", fontSize: 11 }}
                />
                <YAxis
                  stroke="#8b93a1"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => v.toFixed(2)}
                  label={{ value: "Price", angle: -90, position: "insideLeft", fill: "#8b93a1", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1e24", border: "1px solid #262b33", fontSize: 12 }}
                  formatter={(v: number) => v.toFixed(4)}
                  labelFormatter={(v: number) => `${v.toFixed(2)} SOL raised`}
                />
                <Line type="monotone" dataKey="price" stroke="#5b9dff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="panel">
            <div className="scorecard-header">
              <h2 style={{ margin: 0 }}>Scorecard</h2>
              <span className={`verdict-badge verdict-${report.overallVerdict}`}>
                {report.overallVerdict}
              </span>
            </div>
            {report.results.map((r) => (
              <div className={`scenario-card ${SEVERITY_LABEL[r.severity]}`} key={r.scenarioName}>
                <div className="scenario-name">{r.scenarioName}</div>
                <div className="scenario-headline">{r.headline}</div>
                <div className="scenario-detail">{r.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const presetBtnStyle: React.CSSProperties = {
  flex: 1,
  background: "#1a1e24",
  border: "1px solid #262b33",
  color: "#e6e9ee",
  borderRadius: 6,
  padding: "0.5rem 0.6rem",
  fontSize: "0.82rem",
  cursor: "pointer",
};

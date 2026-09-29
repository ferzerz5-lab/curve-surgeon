export default function AboutPage() {
  return (
    <div className="page">
      <div className="header">
        <h1>About</h1>
        <p>What&apos;s actually under the hood.</p>
      </div>

      <div className="panel intro-panel">
        <h2>Architecture</h2>
        <pre className="code-block">{`src/lib/
  types.ts              -- PoolConfigDraft, ScenarioResult, ScorecardReport
  curve-math.ts          -- segment formulas (base/quote amounts, simulateBuy)
  fee-math.ts            -- fee scheduler / rate limiter / fee-split math
  example-configs.ts     -- a risky config and a hardened config for demos
  scenarios/
    locked-liquidity.ts
    whale-impact.ts
    sniper-stress.ts
    migration-dust.ts    -- "Curve Sizing / Stranded Supply" scenario
    index.ts             -- runFullAudit() orchestrator
scripts/
  run-scenarios.ts        -- CLI entry point
  devnet-validate.ts       -- real devnet deployment + validation script
src/app/
  page.tsx                -- home
  simulator/               -- the interactive tool
  how-it-works/            -- the four checks, explained
  devnet-proof/            -- validation results
  about/                   -- this page`}</pre>
      </div>

      <div className="panel intro-panel">
        <h2>Built with</h2>
        <p>
          Next.js (App Router) and React for the site, Recharts for the live
          curve chart, and the real{" "}
          <code>@meteora-ag/dynamic-bonding-curve-sdk</code> for both the
          simulator&apos;s reference math and the devnet validation script.
          TypeScript throughout.
        </p>
      </div>

      <div className="panel intro-panel">
        <h2>Links</h2>
        <p>
          <a
            href="https://github.com/ferzerz5-lab/curve-surgeon"
            target="_blank"
            rel="noreferrer"
          >
            GitHub repository →
          </a>
        </p>
        <p>
          <a
            href="https://superteam.fun/earn/listing/meteora-dbc"
            target="_blank"
            rel="noreferrer"
          >
            Meteora DBC hackathon track →
          </a>
        </p>
      </div>
    </div>
  );
}

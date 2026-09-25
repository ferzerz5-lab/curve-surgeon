# Curve Surgeon

A pre-launch simulator and auditor for [Meteora Dynamic Bonding Curve (DBC)](https://docs.meteora.ag/overview/products/dbc/what-is-dbc) configs.

**The problem:** DBC makes launching a liquid, tradeable token an API call —
no upfront liquidity needed, automatic migration to a real pool once a quote
threshold is hit. That ease of use cuts both ways: a badly shaped curve, a
missing anti-sniper fee, or LP percentages that violate the protocol's
locked-liquidity rule can cost real money or get rejected on-chain — and
nobody catches it until it's live.

**What this does:** runs a candidate `PoolConfig` through four concrete,
named adversarial checks *before* you deploy, and produces a scorecard with
dollar/percent-denominated verdicts instead of a vague pass/fail.

## The four checks

| Scenario | What it catches |
|---|---|
| **Locked Liquidity Compliance** | Configs that violate DBC's hard 10%-locked-at-day-1 minimum (these get rejected on-chain) |
| **Whale Impact** | How much a single large buy can move price in one transaction |
| **Sniper Stress Test** | Whether your fee scheduler / rate limiter actually deters first-block bot buys, or is cosmetic |
| **Curve Sizing / Stranded Supply** | Whether segment capacity is sanely sized relative to your migration threshold, or leaves a large chunk of configured supply unreachable |

## Running it

```bash
npm install
npm run sim
```

This runs the audit against two example configs in
`src/lib/example-configs.ts` — a naive, unaudited config and a hardened one —
so you can see the scorecard contrast directly.

## Architecture

```
src/lib/
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
```

## Known simplifications (read before demoing)

- **Floating point, not on-chain fixed point.** The real DBC program stores
  `sqrt_price` and liquidity as u128 Q64.64 fixed-point values and does
  integer division on-chain. This simulator uses plain floating-point numbers
  for directional accuracy, not lamport-exact precision. Good enough to catch
  a badly shaped curve; not a substitute for simulating against the real SDK's
  on-chain quote functions before trusting numbers to the cent.
- **"Curve Sizing / Stranded Supply" is a proxy, not the exact on-chain dust
  mechanism.** Meteora's docs note the final swap crossing the migration
  threshold can leave unmatched base-token dust from a partial fill — that's
  an integer-rounding effect this floating-point model can't reproduce
  exactly. What it *does* correctly catch: segments sized far beyond what's
  needed to hit your migration threshold, which is a more common and more
  costly mistake than rounding dust.

## Next steps

1. **Verify the SDK wiring.** `src/lib/sdk-wrapper.ts` now bridges our
   `PoolConfigDraft` to the real `@meteora-ag/dynamic-bonding-curve-sdk`'s
   `buildCurveWithMarketCap`, written directly against Meteora's documented
   API (function names, enums, fee/token param shapes). It was **not**
   compiled against the real package locally (no network access when this
   was written) — run `npm install && npx tsc --noEmit` and fix any
   field-name drift before treating its output as ground truth. Once it
   compiles clean, the curve config the simulator analyzed and the one you
   actually deploy are guaranteed to be the same object, not just similar.
2. **Live devnet validation.** Use `createDbcClient()` in `sdk-wrapper.ts`
   to deploy a candidate config to devnet, run each scenario as a real
   scripted swap, and diff the observed on-chain result against this
   simulator's prediction. This is the strongest demo moment — proving the
   simulation matches reality, not just asserting it.
3. **UI.** A curve visualizer (drag segment sliders, redraw live) plus the
   scorecard, built as a Next.js page using `recharts` for the curve chart.
4. **Exportable fix.** Instead of only flagging problems, output a corrected
   `PoolConfig` JSON with the fewest changes needed to pass all four checks.

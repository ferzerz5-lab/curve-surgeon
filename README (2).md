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
  for directional accuracy, not lamport-exact precision. See "Devnet
  validation" below for how close that actually gets in practice (within
  0.0002% on a real deployed pool).
- **"Curve Sizing / Stranded Supply" is a proxy, not the exact on-chain dust
  mechanism.** Meteora's docs note the final swap crossing the migration
  threshold can leave unmatched base-token dust from a partial fill — that's
  an integer-rounding effect this floating-point model can't reproduce
  exactly. What it *does* correctly catch: segments sized far beyond what's
  needed to hit your migration threshold, which is a more common and more
  costly mistake than rounding dust.

## Devnet validation

This isn't just asserted — it's been proven against a real deployed pool.

`scripts/devnet-validate.ts` deploys an actual DBC config + pool to Solana
devnet via the real `@meteora-ag/dynamic-bonding-curve-sdk`, reads back the
**real on-chain curve** the SDK created, and asks the SDK for a live swap
quote against that live pool. It then runs `curve-math.ts`'s `simulateBuy()`
on those exact real segments and compares the two:

```bash
npm run devnet:validate
```

Latest run, three buy sizes against a real devnet pool:

| Buy size | SDK (on-chain-aware) | curve-math.ts | Difference |
|---|---|---|---|
| 0.5 SOL | 0.487499 | 0.487500 | 0.0002% |
| 2 SOL | 1.949999 | 1.950000 | 0.0001% |
| 5 SOL | 4.874999 | 4.875001 | 0.0000% |

Two real, documented unit-conversion steps were needed to get from the
chain's internal representation to comparable numbers (both explained in
comments in the script): Meteora's `sqrtPrice` needs a token-decimal
correction (base/quote tokens here have different decimals, and Meteora's
docs give the exact formula for this); and `curve-math.ts`'s `simulateBuy()`
doesn't model trading fees itself (that's `fee-math.ts`'s job elsewhere in
this project), so the known flat fee is deducted before comparing. Once both
are accounted for, the two independently-computed numbers agree to within
floating-point noise — not a fudge, an actual convergence.

## Next steps

1. **Exportable fix.** Instead of only flagging problems, output a corrected
   `PoolConfig` JSON with the fewest changes needed to pass all four checks.

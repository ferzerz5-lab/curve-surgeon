import Link from "next/link";
import { CurveSurgeonMark } from "./logo";

export default function HomePage() {
  return (
    <div className="page">
      <div className="hero">
        <div className="brand-row">
          <CurveSurgeonMark />
          <h1>Curve Surgeon</h1>
        </div>
        <p className="hero-tagline">
          A safety check for token launches on Meteora Dynamic Bonding Curve —
          it catches expensive mistakes before you make them, instead of after.
        </p>
        <span className="tool-pill">
          <span className="dot" />
          BUILT FOR METEORA DBC
        </span>

        <div className="hero-actions">
          <Link href="/simulator" className="btn btn-primary">
            Try the Simulator →
          </Link>
          <Link href="/devnet-proof" className="btn btn-secondary">
            See the Devnet Proof
          </Link>
        </div>
      </div>

      <div className="panel intro-panel">
        <h2>The problem</h2>
        <p>
          Meteora DBC lets anyone launch a token where the trading pool
          basically builds itself — no big pile of money required upfront.
          You just fill in some settings and the system creates a working
          market automatically.
        </p>
        <p>
          The catch: those settings are easy to get wrong, and getting them
          wrong is expensive. A missing liquidity lock gets your launch{" "}
          <strong>rejected on-chain</strong>. A badly shaped curve lets one
          whale <strong>move the price 27%</strong> in a single buy. No
          anti-sniper protection means bots buy in at the same price as
          everyone else. Normally you don&apos;t find any of this out until{" "}
          <em>after</em> you&apos;ve already launched.
        </p>
      </div>

      <div className="feature-grid">
        <Link href="/simulator" className="feature-card">
          <div className="feature-card-label">01</div>
          <h3>Live Simulator</h3>
          <p>
            Drag your curve settings and watch the price chart and safety
            scorecard update instantly, before you deploy anything real.
          </p>
        </Link>
        <Link href="/how-it-works" className="feature-card">
          <div className="feature-card-label">02</div>
          <h3>Four Safety Checks</h3>
          <p>
            Locked liquidity, whale impact, sniper resistance, and curve
            sizing — each explained in plain language, not a vague pass/fail.
          </p>
        </Link>
        <Link href="/devnet-proof" className="feature-card">
          <div className="feature-card-label">03</div>
          <h3>Proven on Devnet</h3>
          <p>
            We deployed a real config to Solana devnet and checked our
            predictions against the real chain. Difference: 0.0002%.
          </p>
        </Link>
      </div>
    </div>
  );
}

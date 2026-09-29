import Link from "next/link";

const CHECKS = [
  {
    number: "01",
    name: "Locked Liquidity Compliance",
    plain:
      "Meteora requires at least 10% of liquidity to be locked the moment your token migrates to a real pool. This isn't optional — it's a hard on-chain rule.",
    catches:
      'If your config falls short, this check tells you exactly how far: "Only 5.0% locked — below the protocol\'s hard 10% minimum." That config would simply be rejected on-chain.',
  },
  {
    number: "02",
    name: "Whale Impact",
    plain:
      "This simulates a single large buy — someone spending a meaningful chunk of your total raise in one transaction — and measures how much it moves the price.",
    catches:
      "A curve shaped without enough early liquidity lets one buyer swing the price dramatically in a single trade, which is bad for every trader who comes after them.",
  },
  {
    number: "03",
    name: "Sniper Stress Test",
    plain:
      "Bots watch for new token launches and try to buy in the very first block, before anyone else has a chance. This check tests whether your fee settings actually punish that.",
    catches:
      "Without an anti-sniper fee scheduler, a bot buying in the first second pays the exact same price as a normal trader an hour later — the protection is missing entirely, not just weak.",
  },
  {
    number: "04",
    name: "Curve Sizing / Stranded Supply",
    plain:
      "Your curve is sized to sell a certain amount of tokens before migration happens. This checks whether that sizing actually matches your real migration threshold.",
    catches:
      "If the curve is oversized, a chunk of your configured token supply sits beyond the point where migration triggers — and will never sell. It's permanently stranded.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="page">
      <div className="header">
        <h1>How It Works</h1>
        <p>
          Four concrete checks run against your launch settings, each one
          catching a specific, named way real launches go wrong.
        </p>
      </div>

      <div className="checks-list">
        {CHECKS.map((check) => (
          <div className="panel check-panel" key={check.number}>
            <div className="check-number">{check.number}</div>
            <div>
              <h2 className="check-name">{check.name}</h2>
              <p className="check-plain">{check.plain}</p>
              <p className="check-catches">
                <strong>What it catches:</strong> {check.catches}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="panel intro-panel" style={{ marginTop: "1.5rem" }}>
        <h2>Why not just launch and see?</h2>
        <p>
          Because by the time you see it, it's live. A rejected transaction
          costs you gas and time. A whale-crushed price costs your early
          community trust. A missing anti-sniper fee means bots capture value
          that should have gone to real traders — and none of that is
          reversible after the fact. Checking beforehand is free; fixing it
          after is not.
        </p>
        <Link href="/simulator" className="btn btn-primary" style={{ marginTop: "1rem" }}>
          Try it on a real config →
        </Link>
      </div>
    </div>
  );
}

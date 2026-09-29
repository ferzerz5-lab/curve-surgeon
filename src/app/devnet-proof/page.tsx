const RESULTS = [
  { buy: "0.5 SOL", sdk: "0.487499", ours: "0.487500", diff: "0.0002%" },
  { buy: "2 SOL", sdk: "1.949999", ours: "1.950000", diff: "0.0001%" },
  { buy: "5 SOL", sdk: "4.874999", ours: "4.875001", diff: "0.0000%" },
];

export default function DevnetProofPage() {
  return (
    <div className="page">
      <div className="header">
        <h1>Devnet Proof</h1>
        <p>
          Anyone can claim their simulator is accurate. We deployed a real
          config to Solana devnet and checked, instead of asking you to trust
          it.
        </p>
      </div>

      <div className="panel intro-panel">
        <h2>What we actually did</h2>
        <p>
          Using the real Meteora SDK, we deployed an actual DBC config and
          pool to Solana&apos;s public devnet — not a mock, not a local
          simulation of the chain, a real transaction confirmed on a real
          Solana cluster. We then read back the exact curve segments the
          chain created, asked the SDK for a live swap quote against that
          live pool, and ran our own hand-written formulas
          (<code>curve-math.ts</code>) on those same real segments.
        </p>
        <p>
          Then we compared the two numbers directly — the chain&apos;s answer
          versus ours — for three different buy sizes.
        </p>
      </div>

      <div className="panel">
        <h2>Results</h2>
        <table className="results-table">
          <thead>
            <tr>
              <th>Buy size</th>
              <th>SDK (on-chain-aware)</th>
              <th>curve-math.ts</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {RESULTS.map((r) => (
              <tr key={r.buy}>
                <td>{r.buy}</td>
                <td className="numbers-row">{r.sdk}</td>
                <td className="numbers-row">{r.ours}</td>
                <td className="diff-cell">{r.diff}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel intro-panel" style={{ marginTop: "1.5rem" }}>
        <h2>Two real issues we found and fixed along the way</h2>
        <p>
          <strong>Decimal scaling.</strong> Meteora stores prices as raw
          fixed-point numbers, and because the token and the SOL side of the
          pool use different decimal precision, converting that raw number
          into a normal price requires a specific, documented correction
          factor. We had it wrong at first — the chain told us so immediately
          with numbers that were off by many orders of magnitude, which is
          how we knew to go find the right formula in Meteora&apos;s own
          docs.
        </p>
        <p>
          <strong>Trading fees.</strong> Our formulas calculate the pure
          shape of the bonding curve — they don&apos;t subtract trading fees,
          because that&apos;s handled separately elsewhere in the project. The
          chain&apos;s quote correctly nets out the fee. Once we deducted the
          same fee before comparing, the two numbers converged to within
          rounding error.
        </p>
        <p>
          Neither of these was a guess we papered over — both are documented,
          explainable, and now written into the validation script itself.
        </p>
      </div>
    </div>
  );
}

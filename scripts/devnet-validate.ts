/**
 * DEVNET VALIDATION SCRIPT
 * ------------------------
 * Deploys a real Meteora DBC config + pool to Solana devnet using the
 * official SDK, reads back the actual on-chain curve, asks the SDK for a
 * real swap quote against that live pool, and compares it to what our own
 * curve-math.ts predicts for the exact same curve and buy size.
 *
 * This is the "prove it, don't just claim it" step: everything in
 * src/lib/curve-math.ts is a hand-rolled re-implementation of DBC's
 * documented formulas. This script is how we show the two agree on a real
 * deployed pool, not just in our own test cases.
 *
 * HONESTY NOTE: this was written against Meteora's published docs
 * (docs.meteora.ag) for SDK version 1.5.x, but has not been compiled or run
 * in this environment (no network access here). Treat this as a
 * high-confidence draft -- run it, and if something errors on a field name,
 * paste the error and we'll fix it together. That's expected, not a sign
 * something is fundamentally wrong.
 *
 * PREREQUISITES:
 *   1. package.json's @meteora-ag/dynamic-bonding-curve-sdk version bumped
 *      to ^1.5.10 (done) and `npm install` re-run.
 *   2. `solana-keygen new` already run (creates ~/.config/solana/id.json).
 *   3. `solana config set --url devnet` already run.
 *   4. Wallet funded with devnet SOL (`solana balance` shows > 0).
 *
 * RUN WITH:  npm run devnet:validate
 */

import fs from "fs";
import os from "os";
import path from "path";
import BN from "bn.js";
import { NATIVE_MINT } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  DynamicBondingCurveClient,
  MigrationFeeOption,
  MigrationOption,
  SwapMode,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithCustomSqrtPrices,
  createSqrtPrices,
  deriveDbcPoolAddress,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { simulateBuy, spotPrice, totalQuoteToMigrate, type SegmentBounds } from "../src/lib/curve-math";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function loadLocalCliWallet(): Keypair {
  const p = path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(p, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secret));
}

// Pretty-print helper that survives BN objects, which JSON.stringify chokes on.
function debugLog(label: string, value: unknown) {
  console.log(
    `\n--- ${label} ---\n` +
      JSON.stringify(
        value,
        (_key, v) => (v && v._bn !== undefined ? v.toString() : v),
        2
      )
  );
}

// These sqrt(price) checkpoints mirror the shape of soundConfig in
// example-configs.ts: a launch price of 1, then three rising checkpoints.
// (Absolute liquidity per segment is decided by the SDK from
// totalTokenSupply + liquidityWeights below, not typed in directly here --
// that's why we read the REAL resulting segments back from chain in step 4
// rather than assuming our inputs became the bounds unchanged.)
const SQRT_PRICE_CHECKPOINTS = [1, 1.15, 1.35, 1.55];
const LIQUIDITY_WEIGHTS = [26, 20, 15]; // relative weights, same ratio as soundConfig

async function main() {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");
  const wallet = loadLocalCliWallet();

  console.log("Wallet:", wallet.publicKey.toString());
  const balanceLamports = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balanceLamports / 1e9, "SOL");
  if (balanceLamports < 0.5 * 1e9) {
    throw new Error(
      "Wallet has less than 0.5 SOL. Get more from https://faucet.solana.com before continuing."
    );
  }

  // -------------------------------------------------------------------------
  // 1. Build the curve config (client-side math only, no chain calls yet)
  // -------------------------------------------------------------------------
  const sqrtPrices = createSqrtPrices(
    SQRT_PRICE_CHECKPOINTS,
    TokenDecimal.SIX,
    TokenDecimal.NINE
  );

  const curveConfig = buildCurveWithCustomSqrtPrices({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: TokenDecimal.NINE,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: 1_000_000_000,
      leftover: 1_000,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: 250, // 2.5% base fee, held flat (no scheduler decay
          endingFeeBps: 250, //  needed for this validation run -- keeps the
          numberOfPeriod: 0, //  math we're comparing to simple). SDK requires
          totalDuration: 0, //  these to be 0 when start === end (no decay).
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 20,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps200, // 2% LP fee on the post-migration pool
      migrationFee: {
        feePercentage: 0, // no extra cut taken from the migration threshold itself
        creatorFeePercentage: 0,
      },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 50,
      partnerPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 35,
      creatorPermanentLockedLiquidityPercentage: 15,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    sqrtPrices,
    liquidityWeights: LIQUIDITY_WEIGHTS,
  } as any);

  // -------------------------------------------------------------------------
  // 2. Create the config on-chain
  // -------------------------------------------------------------------------
  const configKeypair = Keypair.generate();
  console.log("\nCreating config:", configKeypair.publicKey.toString());

  const createConfigTx = await client.partner.createConfig({
    config: configKeypair.publicKey,
    feeClaimer: wallet.publicKey,
    leftoverReceiver: wallet.publicKey,
    payer: wallet.publicKey,
    quoteMint: NATIVE_MINT,
    ...curveConfig,
  } as any);
  createConfigTx.feePayer = wallet.publicKey;

  await sendAndConfirmTransaction(connection, createConfigTx, [wallet, configKeypair]);
  console.log("Config confirmed on-chain.");

  // -------------------------------------------------------------------------
  // 3. Create the pool on-chain
  // -------------------------------------------------------------------------
  const baseMint = Keypair.generate();
  console.log("\nCreating pool with base mint:", baseMint.publicKey.toString());

  const createPoolTx = await client.creator.createPool({
    baseMint: baseMint.publicKey,
    config: configKeypair.publicKey,
    name: "Curve Surgeon Test",
    symbol: "CSTEST",
    uri: "https://example.com/token.json",
    payer: wallet.publicKey,
    poolCreator: wallet.publicKey,
  } as any);
  createPoolTx.feePayer = wallet.publicKey;

  await sendAndConfirmTransaction(connection, createPoolTx, [wallet, baseMint]);

  const pool = deriveDbcPoolAddress(NATIVE_MINT, baseMint.publicKey, configKeypair.publicKey);
  console.log("Pool confirmed on-chain:", pool.toString());
  console.log(`View on Solana Explorer: https://explorer.solana.com/address/${pool.toString()}?cluster=devnet`);

  // -------------------------------------------------------------------------
  // 4. Read back the REAL on-chain curve and translate it into our own
  //    SegmentBounds shape, so curve-math.ts can simulate the exact same
  //    curve that actually got deployed (not just our original inputs).
  // -------------------------------------------------------------------------
  const poolState = await client.state.getPool(pool);
  const configState = await client.state.getPoolConfig((poolState as any).poolState.config);

  debugLog("Raw configState (inspect this if the bounds mapping below throws)", configState);

  const Q64 = 2 ** 64;
  const BASE_DECIMAL = 6;
  const QUOTE_DECIMAL = 9;

  // Meteora's own docs give the real-price formula as:
  //   price = (sqrtPrice_raw / 2^64)^2 * 10^(baseDecimal - quoteDecimal)
  // Our curve-math.ts assumes spotPrice = sqrtPrice^2 with NO extra decimal
  // factor, so to make the two conventions agree we fold that documented
  // decimal factor into sqrtPrice itself (this part is exact, not a guess):
  //   sqrtPrice_ours = (sqrtPrice_raw / 2^64) * sqrt(10^(baseDecimal - quoteDecimal))
  const decimalCorrection = Math.sqrt(10 ** (BASE_DECIMAL - QUOTE_DECIMAL));

  const fullCurve: any[] = (configState as any).curve;
  // The on-chain curve array is fixed-size and padded with zero entries beyond
  // the real segments -- keep only the leading non-zero ones.
  const rawCurve = fullCurve.filter((point: any) => !point.sqrtPrice.isZero());
  const startSqrtPrice =
    (Number((configState as any).sqrtStartPrice.toString()) / Q64) * decimalCorrection;

  // Liquidity's internal scale (beyond the Q64.64 exponent) isn't published in
  // exact form, so rather than guess it, we calibrate it against ONE real,
  // known on-chain quantity: the pool's actual migrationQuoteThreshold. If our
  // formula's SHAPE is right, this single calibration constant should make
  // every subsequent buy size line up with the SDK's live quote.
  const uncalibratedBounds: SegmentBounds[] = rawCurve.map((point: any, i: number) => ({
    sqrtPriceLower:
      i === 0 ? startSqrtPrice : (Number(rawCurve[i - 1].sqrtPrice.toString()) / Q64) * decimalCorrection,
    sqrtPriceUpper: (Number(point.sqrtPrice.toString()) / Q64) * decimalCorrection,
    liquidity: Number(point.liquidity.toString()) / Q64,
  }));

  const ourTotalQuote = totalQuoteToMigrate(uncalibratedBounds);
  const realThresholdSol = Number((configState as any).migrationQuoteThreshold.toString()) / 1e9;
  const calibration = ourTotalQuote / realThresholdSol;

  console.log(
    `\nCalibrating liquidity scale against real migration threshold: ${realThresholdSol} SOL` +
      ` (our uncalibrated model implied ${ourTotalQuote.toExponential(4)} -- calibration factor ${calibration.toExponential(4)})`
  );

  const bounds: SegmentBounds[] = uncalibratedBounds.map((b) => ({
    ...b,
    liquidity: b.liquidity / calibration,
  }));

  console.log("\nActual on-chain curve segments (translated + calibrated to our units):");
  console.table(bounds);

  // -------------------------------------------------------------------------
  // 5. For a few buy sizes, compare the SDK's own live quote against our
  //    curve-math.ts simulator running on the SAME real segments.
  // -------------------------------------------------------------------------
  const testBuysInSol = [0.5, 2, 5];

  for (const sol of testBuysInSol) {
    const amountIn = new BN(Math.floor(sol * 1e9));
    const currentPoint = new BN(Math.floor(Date.now() / 1000));

    const sdkQuote = client.pool.swapQuote2({
      virtualPool: poolState,
      config: configState,
      swapBaseForQuote: false,
      swapMode: SwapMode.ExactIn,
      amountIn,
      slippageBps: 100,
      hasReferral: false,
      eligibleForFirstSwapWithMinFee: false,
      currentPoint,
    } as any);

    const ours = simulateBuy(bounds, startSqrtPrice, sol);

    const sdkBaseOut = Number((sdkQuote as any).outputAmount.toString()) / 1e6; // 6 decimals for base token
    const diffPct =
      sdkBaseOut === 0 ? 0 : (Math.abs(sdkBaseOut - ours.baseOut) / sdkBaseOut) * 100;

    console.log(`\n=== Buy ${sol} SOL ===`);
    console.log("SDK (on-chain-aware) base tokens out:", sdkBaseOut.toFixed(6));
    console.log("curve-math.ts predicted base tokens out:", ours.baseOut.toFixed(6));
    console.log(`Difference: ${diffPct.toFixed(4)}%`);
  }

  console.log(
    "\nDone. Small differences (well under 1%) are expected -- curve-math.ts is a\n" +
      "floating-point model; the chain uses fixed-point u128 math internally. A large\n" +
      "difference (>1-2%) means a real formula or unit-scaling bug worth investigating."
  );
}

main().catch((err) => {
  console.error("\nDevnet validation failed:");
  console.error(err);
  process.exit(1);
});

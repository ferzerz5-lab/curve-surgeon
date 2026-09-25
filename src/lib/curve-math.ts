import type { CurveSegment } from "./types";

/**
 * Implements the DBC segment formulas exactly as documented:
 *
 *   Base tokens available across a segment:
 *     baseAmount = L * (1/sqrt(P_lower) - 1/sqrt(P_upper))
 *
 *   Quote tokens required to cross a segment:
 *     quoteAmount = L * (sqrt(P_upper) - sqrt(P_lower))
 *
 * A "curve" here is an ordered array of segments, each carrying its own
 * upper sqrt_price bound and virtual liquidity L. The lower bound of segment
 * i is the upper bound of segment i-1 (segment 0's lower bound is the launch
 * price, sqrtPriceStart).
 */

export interface SegmentBounds {
  sqrtPriceLower: number;
  sqrtPriceUpper: number;
  liquidity: number;
}

export function segmentsToBounds(
  sqrtPriceStart: number,
  segments: CurveSegment[]
): SegmentBounds[] {
  const bounds: SegmentBounds[] = [];
  let lower = sqrtPriceStart;
  for (const seg of segments) {
    bounds.push({
      sqrtPriceLower: lower,
      sqrtPriceUpper: seg.sqrtPriceUpper,
      liquidity: seg.liquidity,
    });
    lower = seg.sqrtPriceUpper;
  }
  return bounds;
}

export function baseAmountInSegment(b: SegmentBounds): number {
  return b.liquidity * (1 / b.sqrtPriceLower - 1 / b.sqrtPriceUpper);
}

export function quoteAmountInSegment(b: SegmentBounds): number {
  return b.liquidity * (b.sqrtPriceUpper - b.sqrtPriceLower);
}

/** Total quote tokens required to fully traverse the curve (launch -> final segment) */
export function totalQuoteToMigrate(bounds: SegmentBounds[]): number {
  return bounds.reduce((sum, b) => sum + quoteAmountInSegment(b), 0);
}

/** Total base tokens sold if the curve is fully traversed */
export function totalBaseSold(bounds: SegmentBounds[]): number {
  return bounds.reduce((sum, b) => sum + baseAmountInSegment(b), 0);
}

/**
 * Given a starting sqrt_price position on the curve and an incoming quote
 * amount (a buy), walk forward through segments and return the resulting
 * sqrt_price and base tokens received. This is the core "quote a swap"
 * function every scenario builds on.
 */
export function simulateBuy(
  bounds: SegmentBounds[],
  currentSqrtPrice: number,
  quoteIn: number
): { newSqrtPrice: number; baseOut: number; avgExecutionPrice: number } {
  let remainingQuote = quoteIn;
  let sqrtPrice = currentSqrtPrice;
  let baseOut = 0;

  for (const b of bounds) {
    if (sqrtPrice >= b.sqrtPriceUpper) continue; // already past this segment
    const segLower = Math.max(sqrtPrice, b.sqrtPriceLower);
    const segBounds: SegmentBounds = {
      sqrtPriceLower: segLower,
      sqrtPriceUpper: b.sqrtPriceUpper,
      liquidity: b.liquidity,
    };
    const quoteNeededForSegment = quoteAmountInSegment(segBounds);

    if (remainingQuote < quoteNeededForSegment) {
      // Buy ends inside this segment. Solve for the new sqrt_price given
      // partial quote input: quote = L * (sqrtP_new - sqrtP_lower)
      const newSqrtPrice = segLower + remainingQuote / b.liquidity;
      const partialBounds: SegmentBounds = {
        sqrtPriceLower: segLower,
        sqrtPriceUpper: newSqrtPrice,
        liquidity: b.liquidity,
      };
      baseOut += baseAmountInSegment(partialBounds);
      sqrtPrice = newSqrtPrice;
      remainingQuote = 0;
      break;
    } else {
      baseOut += baseAmountInSegment(segBounds);
      remainingQuote -= quoteNeededForSegment;
      sqrtPrice = b.sqrtPriceUpper;
    }
  }

  const avgExecutionPrice = baseOut > 0 ? (quoteIn - remainingQuote) / baseOut : 0;

  return { newSqrtPrice: sqrtPrice, baseOut, avgExecutionPrice };
}

/** Spot price at a given sqrt_price position (price = sqrt_price^2) */
export function spotPrice(sqrtPrice: number): number {
  return sqrtPrice * sqrtPrice;
}

/**
 * Samples the curve into (cumulativeQuote, price) points suitable for
 * charting. Walks the curve in small quote-sized steps from launch up to
 * the migration threshold (or full curve capacity, whichever is smaller).
 */
export function sampleCurveForChart(
  bounds: SegmentBounds[],
  sqrtPriceStart: number,
  upToQuote: number,
  steps: number = 60
): { cumulativeQuote: number; price: number }[] {
  const points: { cumulativeQuote: number; price: number }[] = [
    { cumulativeQuote: 0, price: spotPrice(sqrtPriceStart) },
  ];
  const stepSize = upToQuote / steps;
  for (let i = 1; i <= steps; i++) {
    const quoteIn = stepSize * i;
    const { newSqrtPrice } = simulateBuy(bounds, sqrtPriceStart, quoteIn);
    points.push({ cumulativeQuote: quoteIn, price: spotPrice(newSqrtPrice) });
  }
  return points;
}

import type { PairId } from "./pairs.ts";
import type { Candle } from "./screening.ts";

const BUCKET_MS = 300_000;

export function spotFits(pair: PairId, lastClose: number, spot: number): boolean {
  if (!Number.isFinite(lastClose) || !Number.isFinite(spot) || lastClose <= 0 || spot <= 0) return false;
  const gap = Math.abs(spot - lastClose);
  if (pair === "XAUUSD") return gap <= lastClose * 0.02;
  if (pair === "USDJPY") return gap <= 0.5;
  return gap <= 0.005;
}

export function shiftToSpot(
  candles: Candle[],
  spot: number,
  previousClose: number | null,
): { candles: Candle[]; previousClose: number | null } {
  if (!candles.length || !Number.isFinite(spot)) {
    return { candles: candles.map((candle) => ({ ...candle })), previousClose };
  }
  const basis = spot - candles[candles.length - 1].close;
  const shifted = candles.map((candle) => ({
    time: candle.time,
    open: candle.open + basis,
    high: candle.high + basis,
    low: candle.low + basis,
    close: candle.close + basis,
    volume: candle.volume,
  }));
  const tail = shifted[shifted.length - 1];
  tail.close = spot;
  tail.high = Math.max(tail.high, spot);
  tail.low = Math.min(tail.low, spot);
  return {
    candles: shifted,
    previousClose: previousClose == null || !Number.isFinite(previousClose) ? null : previousClose + basis,
  };
}

export function applyExtreme(
  candles: Candle[],
  price: number,
  time: number,
  extreme?: { high: number; low: number },
  bucketMs = BUCKET_MS,
): Candle[] {
  if (!candles.length || !Number.isFinite(price) || !Number.isFinite(time) || time <= 0) {
    return candles.map((candle) => ({ ...candle }));
  }
  const bucket = Math.floor(time / bucketMs) * bucketMs;
  const hi = Math.max(price, extreme?.high ?? price);
  const lo = Math.min(price, extreme?.low ?? price);
  const next = candles.map((candle) => ({ ...candle }));
  const last = next[next.length - 1];
  const lastBucket = Math.floor(last.time / bucketMs) * bucketMs;
  if (lastBucket === bucket) {
    next[next.length - 1] = {
      ...last,
      close: price,
      high: Math.max(last.high, hi),
      low: Math.min(last.low, lo),
    };
    return next.slice(-240);
  }
  if (bucket > lastBucket) {
    next.push({
      time: bucket,
      open: last.close,
      high: Math.max(last.close, hi),
      low: Math.min(last.close, lo),
      close: price,
      volume: 0,
    });
  }
  return next.slice(-240);
}

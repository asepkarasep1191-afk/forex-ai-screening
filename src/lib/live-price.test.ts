import assert from "node:assert/strict";
import test from "node:test";
import { applyExtreme, shiftToSpot, spotFits } from "./live-price.ts";
import type { Candle } from "./screening.ts";

function bar(time: number, close: number): Candle {
  return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 1 };
}

test("shiftToSpot moves the series so the last close is the spot", () => {
  const candles = [bar(0, 100), bar(300_000, 110)];
  const shifted = shiftToSpot(candles, 113, 90);
  assert.equal(shifted.candles[1].close, 113);
  assert.equal(shifted.candles[0].close, 103);
  assert.equal(shifted.candles[0].high - shifted.candles[0].low, 3);
  assert.equal(shifted.previousClose, 93);
  assert.equal(candles[1].close, 110);
});

test("applyExtreme extends the forming bar and then opens the next one", () => {
  const candles = [bar(0, 10)];
  const first = applyExtreme(candles, 12, 100_000, { high: 12.4, low: 11.5 });
  assert.equal(first.length, 1);
  assert.equal(first[0].close, 12);
  assert.equal(first[0].high, 12.4);
  assert.equal(first[0].low, 8);
  const next = applyExtreme(first, 13, 300_000);
  assert.equal(next.length, 2);
  assert.equal(next[1].time, 300_000);
  assert.equal(next[1].open, 12);
  assert.equal(next[1].close, 13);
});

test("spotFits rejects a gold print that is far from the candle", () => {
  assert.equal(spotFits("XAUUSD", 3800, 3810), true);
  assert.equal(spotFits("XAUUSD", 3800, 4000), false);
  assert.equal(spotFits("EURUSD", 1.1, 1.1004), true);
  assert.equal(spotFits("EURUSD", 1.1, 1.2), false);
});

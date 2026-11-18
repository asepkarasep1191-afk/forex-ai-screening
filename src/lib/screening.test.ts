import assert from "node:assert/strict";
import test from "node:test";
import type { Candle } from "./screening.ts";
import { lockSetup, quoteIsFresh, resample, screenBook, selectLocks, tickSetup, watchLean, type MarketView, type SetupPlan } from "./screening.ts";

function plan(overrides: Partial<SetupPlan> = {}): SetupPlan {
  return {
    pair: "EURUSD",
    timeframe: "M5",
    direction: "long",
    entry: 1.1,
    entryZoneLow: 1.0998,
    entryZoneHigh: 1.1002,
    sl: 1.099,
    tp1: 1.101,
    tp2: 1.102,
    tp3: 1.103,
    methods: ["VWAP", "Trend", "Price Action"],
    confluence: 3,
    confidence: 61,
    methodDetails: [],
    rationale: "",
    pipsRisk: 10,
    riskReward: 1,
    ...overrides,
  };
}

function bar(time: number, low: number, high: number, close = (low + high) / 2): Candle {
  return { time, open: close, high, low, close, volume: 1 };
}

test("resample groups three 5m bars into one 15m bar", () => {
  const candles = [
    bar(0, 1, 2, 1.5),
    bar(300_000, 1.2, 2.4, 2),
    bar(600_000, 1.1, 2.2, 1.4),
    bar(900_000, 3, 4, 3.5),
  ];
  const out = resample(candles, 15);
  assert.equal(out.length, 2);
  assert.equal(out[0].open, 1.5);
  assert.equal(out[0].high, 2.4);
  assert.equal(out[0].low, 1);
  assert.equal(out[0].close, 1.4);
  assert.equal(out[1].close, 3.5);
});

test("live long stops out at original SL for -1R", () => {
  const locked = lockSetup(plan(), 1.1005, 0, 1);
  assert.equal(locked.phase, "live");
  const stepped = tickSetup(locked, bar(0, 1.0988, 1.1006, 1.0989), 1.0989, 2);
  assert.equal(stepped.setup, null);
  assert.equal(stepped.closed?.outcome, "sl");
  assert.equal(stepped.closed?.rMultiple, -1);
  assert.equal(stepped.closed?.result, "loss");
});

test("TP1 moves stop to entry, then a return is breakeven", () => {
  let locked = lockSetup(plan(), 1.1004, 0, 1);
  const tp1 = tickSetup(locked, bar(0, 1.1002, 1.1012, 1.1011), 1.1011, 2);
  assert.ok(tp1.setup);
  assert.equal(tp1.setup?.phase, "tp1");
  assert.equal(tp1.setup?.stopPrice, 1.1);
  const back = tickSetup(tp1.setup, bar(0, 1.0999, 1.1011, 1.1), 1.1, 3);
  assert.equal(back.closed?.outcome, "be");
  assert.equal(back.closed?.result, "be");
  assert.equal(back.closed?.rMultiple, 0);
});

test("TP2 then stop at TP1 is a +1R win", () => {
  const locked = lockSetup(plan(), 1.1004, 0, 1);
  const tp2 = tickSetup(locked, bar(0, 1.1003, 1.1022, 1.102), 1.102, 2);
  assert.equal(tp2.setup?.phase, "tp2");
  assert.equal(tp2.setup?.stopPrice, 1.101);
  const stopped = tickSetup(tp2.setup!, bar(300_000, 1.1008, 1.1016, 1.1009), 1.1009, 3);
  assert.equal(stopped.closed?.outcome, "tp1");
  assert.equal(stopped.closed?.rMultiple, 1);
  assert.equal(stopped.closed?.result, "win");
});

test("TP3 closes the locked setup at +3R", () => {
  const locked = lockSetup(plan(), 1.1002, 0, 1);
  const done = tickSetup(locked, bar(0, 1.1001, 1.1032, 1.103), 1.103, 2);
  assert.equal(done.closed?.outcome, "tp3");
  assert.equal(done.closed?.rMultiple, 3);
});

test("an old wick already seen does not stop the trade after TP1", () => {
  const locked = lockSetup(plan(), 1.1004, 0, 1);
  const tp1 = tickSetup(locked, bar(0, 1.0996, 1.1011, 1.101), 1.101, 2);
  assert.equal(tp1.setup?.phase, "tp1");
  assert.equal(tp1.setup?.stopPrice, 1.1);
  const again = tickSetup(tp1.setup!, bar(0, 1.0996, 1.1011, 1.1008), 1.1008, 3);
  assert.equal(again.closed, undefined);
  assert.equal(again.setup?.phase, "tp1");
});

test("pending long fills then records SL", () => {
  const locked = lockSetup(plan(), 1.0995, 0, 1);
  assert.equal(locked.phase, "pending");
  const filled = tickSetup(locked, bar(0, 1.0988, 1.0996, 1.0989), 1.0989, 2);
  assert.equal(filled.closed?.outcome, "sl");
});

test("a locked slot is not replaced by a new scan", () => {
  const locked = lockSetup(plan(), 1.1002, 0, 5);
  const candles: Candle[] = Array.from({ length: 50 }, (_, i) => bar(i * 300_000, 1.1, 1.101, 1.1005));
  const time = candles.at(-1)!.time;
  const screened = screenBook(
    [{ pair: "EURUSD", candles, price: 1.1004, time }],
    [locked],
    { paused: false, now: time },
  );
  assert.equal(screened.running.length, 1);
  assert.equal(screened.running[0].id, locked.id);
  assert.equal(screened.running[0].confidence, locked.confidence);
});

test("a stale quote does not move or replace a locked setup", () => {
  const locked = lockSetup(plan(), 1.1002, 0, 5);
  const candles: Candle[] = Array.from({ length: 50 }, (_, i) => bar(i * 300_000, 1.1, 1.101, 1.1005));
  const screened = screenBook(
    [{ pair: "EURUSD", candles, price: 1.09, time: 1_000 }],
    [locked],
    { paused: false, now: 1_000 + 120_000 },
  );
  assert.equal(screened.running.length, 1);
  assert.equal(screened.running[0].currentPrice, locked.currentPrice);
  assert.equal(screened.closed.length, 0);
});

test("only the highest confidence timeframe locks per pair", () => {
  const weaker = plan({ timeframe: "M5", confidence: 61 });
  const stronger = plan({ timeframe: "M15", confidence: 74 });
  const chosen = selectLocks([], [weaker, stronger], false);
  assert.equal(chosen.lock.length, 1);
  assert.equal(chosen.lock[0].timeframe, "M15");
  assert.equal(chosen.hold.length, 1);
  assert.equal(chosen.hold[0].plan.timeframe, "M5");
});

test("a busy pair keeps the next setup on the background list", () => {
  const waiting = plan({ timeframe: "M15", confidence: 80 });
  const chosen = selectLocks([{ pair: "EURUSD", timeframe: "M5" }], [waiting], false);
  assert.equal(chosen.lock.length, 0);
  assert.match(chosen.hold[0].note, /terkunci/);
});

test("two confirmed methods stay a watch, not a lock", () => {
  const market: MarketView = {
    pair: "GBPUSD",
    timeframe: "M5",
    candles: [],
    currentPrice: 1.2,
    vwap: { value: 1.2, upperBand: 1.21, lowerBand: 1.19, deviation: 0.01 },
    levels: [],
    zones: [],
    liquidity: [],
    priceAction: [],
    trend: "bullish",
    trendStrength: 0.2,
    methods: [
      { name: "VWAP", confirmed: true, direction: "long", detail: "" },
      { name: "Trend", confirmed: true, direction: "long", detail: "" },
      { name: "Support/Resistance", confirmed: false, direction: "neutral", detail: "" },
    ],
  };
  const watch = watchLean(market);
  assert.equal(watch?.status, "watch");
  assert.equal(watch?.confluence, 2);
});

test("quote freshness rejects a delayed print", () => {
  assert.equal(quoteIsFresh(10_000, 10_000), true);
  assert.equal(quoteIsFresh(10_000, 60_000), false);
  assert.equal(quoteIsFresh(0, 10_000), false);
});

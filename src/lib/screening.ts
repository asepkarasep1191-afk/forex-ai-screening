import { formatPrice, pairSpec, roundTo, type PairId, type Timeframe } from "./pairs.ts";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Direction = "long" | "short";
export type Bias = Direction | "neutral";
export type Trend = "bullish" | "bearish" | "ranging";

export type Level = {
  price: number;
  strength: number;
  touches: number;
  type: "support" | "resistance";
};

export type Zone = {
  low: number;
  high: number;
  strength: number;
  type: "demand" | "supply" | "bank_buy" | "bank_sell";
  label: string;
};

export type LiquidityPool = {
  price: number;
  type: "buyside" | "sellside";
  label: string;
  strength: number;
};

export type PriceSignal = {
  type: string;
  direction: Direction;
  strength: number;
  description: string;
};

export type MethodCheck = {
  name: string;
  confirmed: boolean;
  direction: Bias;
  detail: string;
};

export type Vwap = {
  value: number;
  upperBand: number;
  lowerBand: number;
  deviation: number;
};

export type MarketView = {
  pair: PairId;
  timeframe: Timeframe;
  candles: Candle[];
  currentPrice: number;
  vwap: Vwap;
  levels: Level[];
  zones: Zone[];
  liquidity: LiquidityPool[];
  priceAction: PriceSignal[];
  trend: Trend;
  trendStrength: number;
  methods: MethodCheck[];
};

export type SetupPlan = {
  pair: PairId;
  timeframe: Timeframe;
  direction: Direction;
  entry: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  methods: string[];
  confluence: number;
  confidence: number;
  methodDetails: MethodCheck[];
  rationale: string;
  pipsRisk: number;
  riskReward: number;
};

export type Phase = "pending" | "live" | "tp1" | "tp2";

export type LockedSetup = SetupPlan & {
  id: string;
  phase: Phase;
  lockedAt: number;
  filledAt: number | null;
  tp1HitAt: number | null;
  tp2HitAt: number | null;
  currentPrice: number;
  stopPrice: number;
  trackBar: number;
  trackHigh: number;
  trackLow: number;
};

export type CloseOutcome = "sl" | "be" | "tp1" | "tp3";

export type ClosedTrade = {
  id: string;
  pair: PairId;
  timeframe: Timeframe;
  direction: Direction;
  confidence: number;
  confluence: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  methods: string[];
  lockedAt: number;
  closedAt: number;
  exitPrice: number;
  outcome: CloseOutcome;
  rMultiple: number;
  result: "win" | "loss" | "be";
};

export type RadarStatus = "queued" | "late" | "watch";

export type RadarItem = {
  pair: PairId;
  timeframe: Timeframe;
  direction: Bias;
  confidence: number;
  confluence: number;
  status: RadarStatus;
  note: string;
};

export type ActivityNote = {
  id: string;
  at: number;
  text: string;
  tone: "lock" | "win" | "loss" | "info";
};

const METHOD_COUNT = 7;
const MIN_CONFLUENCE = 3;

export function resample(candles: Candle[], minutes: number): Candle[] {
  if (minutes <= 5) return candles;
  const bucketMs = minutes * 60 * 1000;
  const groups = new Map<number, Candle>();
  for (const candle of candles) {
    const time = Math.floor(candle.time / bucketMs) * bucketMs;
    const prev = groups.get(time);
    if (!prev) {
      groups.set(time, { ...candle, time });
      continue;
    }
    prev.high = Math.max(prev.high, candle.high);
    prev.low = Math.min(prev.low, candle.low);
    prev.close = candle.close;
    prev.volume += candle.volume;
  }
  return [...groups.values()].sort((a, b) => a.time - b.time);
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function vwapOf(candles: Candle[], lookback = 50): Vwap {
  const slice = candles.slice(-lookback);
  const equalWeight = !slice.some((candle) => candle.volume > 0);
  let weighted = 0;
  let weight = 0;
  for (const candle of slice) {
    const typical = (candle.high + candle.low + candle.close) / 3;
    const vol = equalWeight ? 1 : candle.volume;
    weighted += typical * vol;
    weight += vol;
  }
  const last = slice[slice.length - 1]?.close ?? 0;
  const value = weight > 0 ? weighted / weight : last;
  let variance = 0;
  for (const candle of slice) {
    const typical = (candle.high + candle.low + candle.close) / 3;
    const vol = equalWeight ? 1 : candle.volume;
    variance += (typical - value) ** 2 * vol;
  }
  const deviation = Math.sqrt(weight > 0 ? variance / weight : 0);
  return { value, upperBand: value + deviation, lowerBand: value - deviation, deviation };
}

function swingLevels(candles: Candle[], lookback = 60): Level[] {
  const slice = candles.slice(-lookback);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 2; i < slice.length - 2; i++) {
    const candle = slice[i];
    if (
      candle.high > slice[i - 1].high &&
      candle.high > slice[i - 2].high &&
      candle.high > slice[i + 1].high &&
      candle.high > slice[i + 2].high
    ) {
      highs.push(candle.high);
    }
    if (
      candle.low < slice[i - 1].low &&
      candle.low < slice[i - 2].low &&
      candle.low < slice[i + 1].low &&
      candle.low < slice[i + 2].low
    ) {
      lows.push(candle.low);
    }
  }
  const cluster = (slice[0].high - slice[0].low) * 1.5;
  const levels: Level[] = [];
  const absorb = (price: number, type: Level["type"]) => {
    const found = levels.find((level) => level.type === type && Math.abs(level.price - price) < cluster);
    if (found) {
      found.price = (found.price * found.touches + price) / (found.touches + 1);
      found.touches += 1;
      found.strength = Math.min(found.touches * 0.3, 1);
    } else {
      levels.push({ price, strength: 0.3, touches: 1, type });
    }
  };
  highs.forEach((price) => absorb(price, "resistance"));
  lows.forEach((price) => absorb(price, "support"));
  return levels.sort((a, b) => b.strength - a.strength);
}

function supplyDemand(candles: Candle[], lookback = 50): Zone[] {
  const slice = candles.slice(-lookback);
  const zones: Zone[] = [];
  for (let i = 3; i < slice.length - 1; i++) {
    const candle = slice[i];
    const prev = slice[i - 1];
    const next = slice[i + 1];
    const body = Math.abs(candle.close - candle.open);
    const range = candle.high - candle.low;
    const prevBody = Math.abs(prev.close - prev.open);
    if (range <= 0) continue;
    if (candle.close > candle.open && body > range * 0.6 && body > prevBody * 1.8 && next.close > candle.close) {
      const low = Math.min(candle.open, prev.low);
      const high = Math.max(candle.close, candle.open);
      if (!zones.some((zone) => zone.type === "demand" && Math.abs(zone.low - low) < range * 2)) {
        zones.push({ low, high, strength: 0.6, type: "demand", label: "Demand zone" });
      }
    }
    if (candle.close < candle.open && body > range * 0.6 && body > prevBody * 1.8 && next.close < candle.close) {
      const high = Math.max(candle.open, prev.high);
      const low = Math.min(candle.close, candle.open);
      if (!zones.some((zone) => zone.type === "supply" && Math.abs(zone.high - high) < range * 2)) {
        zones.push({ low, high, strength: 0.6, type: "supply", label: "Supply zone" });
      }
    }
  }
  return zones;
}

function bankZones(candles: Candle[], vwap: Vwap, lookback = 40): Zone[] {
  const slice = candles.slice(-lookback);
  const zones: Zone[] = [];
  const hasVolume = slice.some((candle) => candle.volume > 0);
  let i = 0;
  while (i < slice.length) {
    const candle = slice[i];
    const range = candle.high - candle.low;
    const window = slice.slice(Math.max(0, i - 5), i);
    const avg = window.length > 0 ? window.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / window.length : range;
    const volumeOk = hasVolume ? candle.volume > 3000 : true;
    if (avg > 0 && range < avg * 0.6 && volumeOk) {
      let end = i + 1;
      while (end < slice.length && slice[end].high - slice[end].low < avg * 0.7) end += 1;
      if (end - i >= 3) {
        const block = slice.slice(i, end);
        const low = Math.min(...block.map((bar) => bar.low));
        const high = Math.max(...block.map((bar) => bar.high));
        const mid = (low + high) / 2;
        if (mid <= vwap.lowerBand + vwap.deviation * 0.3) {
          zones.push({ low, high, strength: 0.7, type: "bank_buy", label: "Institutional Buy Zone" });
        } else if (mid >= vwap.upperBand - vwap.deviation * 0.3) {
          zones.push({ low, high, strength: 0.7, type: "bank_sell", label: "Institutional Sell Zone" });
        }
        i = end;
        continue;
      }
    }
    i += 1;
  }
  return zones;
}

function liquidityPools(candles: Candle[], levels: Level[], lookback = 40): LiquidityPool[] {
  const slice = candles.slice(-lookback);
  const pools: LiquidityPool[] = [];
  const highs = slice
    .map((candle, idx) => ({ price: candle.high, idx }))
    .filter(
      ({ idx }) =>
        idx >= 2 &&
        idx <= slice.length - 3 &&
        slice[idx].high >= slice[idx - 1].high &&
        slice[idx].high >= slice[idx + 1].high,
    );
  const lows = slice
    .map((candle, idx) => ({ price: candle.low, idx }))
    .filter(
      ({ idx }) =>
        idx >= 2 &&
        idx <= slice.length - 3 &&
        slice[idx].low <= slice[idx - 1].low &&
        slice[idx].low <= slice[idx + 1].low,
    );
  const tolerance = (slice[0].high - slice[0].low) * 0.5;
  const cluster = (points: { price: number }[], type: LiquidityPool["type"], noun: string) => {
    const used = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (used.has(i)) continue;
      const group = [points[i]];
      for (let j = i + 1; j < points.length; j++) {
        if (Math.abs(points[j].price - points[i].price) < tolerance) {
          group.push(points[j]);
          used.add(j);
        }
      }
      if (group.length >= 2) {
        const price = group.reduce((sum, item) => sum + item.price, 0) / group.length;
        pools.push({
          price,
          type,
          label: `${noun} (${group.length} equal ${type === "buyside" ? "highs" : "lows"})`,
          strength: Math.min(group.length * 0.25, 1),
        });
      }
    }
  };
  cluster(highs, "buyside", "Buy-side liquidity");
  cluster(lows, "sellside", "Sell-side liquidity");
  for (const level of levels.slice(0, 4)) {
    if (level.touches < 2) continue;
    pools.push({
      price: level.price,
      type: level.type === "resistance" ? "buyside" : "sellside",
      label: `${level.type === "resistance" ? "Buy-side" : "Sell-side"} liquidity at ${level.type}`,
      strength: level.strength * 0.8,
    });
  }
  return pools.sort((a, b) => b.strength - a.strength);
}

function priceAction(candles: Candle[], levels: Level[], pools: LiquidityPool[]): PriceSignal[] {
  const slice = candles.slice(-10);
  const signals: PriceSignal[] = [];
  const last = slice[slice.length - 1];
  const body = Math.abs(last.close - last.open);
  const upper = last.high - Math.max(last.close, last.open);
  const lower = Math.min(last.close, last.open) - last.low;
  const range = last.high - last.low;
  if (range > 0) {
    if (lower > range * 0.6 && body < range * 0.35) {
      signals.push({ type: "Bullish Pin Bar", direction: "long", strength: 0.7, description: "Long lower wick rejection — buyers stepped in" });
    }
    if (upper > range * 0.6 && body < range * 0.35) {
      signals.push({ type: "Bearish Pin Bar", direction: "short", strength: 0.7, description: "Long upper wick rejection — sellers stepped in" });
    }
  }
  if (slice.length >= 2) {
    const prev = slice[slice.length - 2];
    if (prev.close < prev.open && last.close > last.open && last.close > prev.open && last.open < prev.close) {
      signals.push({ type: "Bullish Engulfing", direction: "long", strength: 0.75, description: "Bullish engulfing — buyers overwhelmed sellers" });
    }
    if (prev.close > prev.open && last.close < last.open && last.close < prev.open && last.open > prev.close) {
      signals.push({ type: "Bearish Engulfing", direction: "short", strength: 0.75, description: "Bearish engulfing — sellers overwhelmed buyers" });
    }
  }
  if (slice.length >= 3) {
    const inside = slice[slice.length - 2];
    const mother = slice[slice.length - 3];
    if (inside.high < mother.high && inside.low > mother.low) {
      if (last.close > mother.high) {
        signals.push({ type: "Inside Bar Breakout (Bullish)", direction: "long", strength: 0.6, description: "Price broke above inside bar range" });
      }
      if (last.close < mother.low) {
        signals.push({ type: "Inside Bar Breakout (Bearish)", direction: "short", strength: 0.6, description: "Price broke below inside bar range" });
      }
    }
  }
  for (const pool of pools.slice(0, 3)) {
    const swept = slice.some((candle) =>
      pool.type === "buyside" ? candle.high > pool.price && candle.close < pool.price : candle.low < pool.price && candle.close > pool.price,
    );
    if (!swept) continue;
    signals.push({
      type: `Liquidity Sweep (${pool.type})`,
      direction: pool.type === "buyside" ? "short" : "long",
      strength: pool.strength * 0.9,
      description: `${pool.label} swept then reversed — smart money entry`,
    });
  }
  for (const level of levels.slice(0, 3)) {
    if (Math.abs(last.close - level.price) >= range * 2) continue;
    if (level.type === "resistance" && last.close < last.open) {
      signals.push({
        type: "Rejection at Resistance",
        direction: "short",
        strength: level.strength * 0.8,
        description: `Price rejected at strong resistance (${level.touches} touches)`,
      });
    }
    if (level.type === "support" && last.close > last.open) {
      signals.push({
        type: "Bounce off Support",
        direction: "long",
        strength: level.strength * 0.8,
        description: `Price bounced off strong support (${level.touches} touches)`,
      });
    }
  }
  return signals;
}

function trendOf(candles: Candle[]): { trend: Trend; trendStrength: number } {
  const slice = candles.slice(-30);
  if (slice.length < 10) return { trend: "ranging", trendStrength: 0 };
  const xs = slice.map((_, index) => index);
  const ys = slice.map((candle) => candle.close);
  const n = slice.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;
  let numer = 0;
  let denom = 0;
  for (let i = 0; i < n; i++) {
    numer += (xs[i] - meanX) * (ys[i] - meanY);
    denom += (xs[i] - meanX) ** 2;
  }
  const slope = denom > 0 ? numer / denom : 0;
  const norm = meanY !== 0 ? slope / meanY : 0;
  const fast = ema(ys, 9);
  const slow = ema(ys, 21);
  let bull = 0;
  let bear = 0;
  if (norm > 0.0001) bull += 1;
  else if (norm < -0.0001) bear += 1;
  if (fast[fast.length - 1] > slow[slow.length - 1]) bull += 1;
  else if (fast[fast.length - 1] < slow[slow.length - 1]) bear += 1;
  const recent = slice.slice(-5);
  if (recent.every((candle, index, arr) => index === 0 || candle.high >= arr[index - 1].high * 0.999)) bull += 1;
  if (recent.every((candle, index, arr) => index === 0 || candle.low <= arr[index - 1].low * 1.001)) bear += 1;
  const strength = Math.min(Math.abs(norm) * 10000, 1);
  if (bull >= 2 && bull > bear) return { trend: "bullish", trendStrength: strength };
  if (bear >= 2 && bear > bull) return { trend: "bearish", trendStrength: strength };
  return { trend: "ranging", trendStrength: 0 };
}

function px(value: number): string {
  return value.toFixed(5).replace(/\.?0+$/, "");
}

function methodsOf(market: MarketView): MethodCheck[] {
  const { currentPrice, vwap, levels, zones, liquidity, priceAction: signals, trend, trendStrength } = market;
  const last = market.candles[market.candles.length - 1];
  const range = last.high - last.low;
  const vwapDelta = currentPrice - vwap.value;
  const vwapCheck: MethodCheck =
    vwapDelta < -vwap.deviation * 0.3
      ? { name: "VWAP", confirmed: true, direction: "long", detail: `Harga di bawah VWAP (${px(vwap.value)}) — bias long mean reversion` }
      : vwapDelta > vwap.deviation * 0.3
        ? { name: "VWAP", confirmed: true, direction: "short", detail: `Harga di atas VWAP (${px(vwap.value)}) — bias short mean reversion` }
        : { name: "VWAP", confirmed: false, direction: "neutral", detail: "Harga dekat VWAP — tidak ada bias" };
  const trendCheck: MethodCheck =
    trend === "bullish" && trendStrength > 0.05
      ? { name: "Trend", confirmed: true, direction: "long", detail: `Tren bullish (kekuatan ${trendStrength.toFixed(2)})` }
      : trend === "bearish" && trendStrength > 0.05
        ? { name: "Trend", confirmed: true, direction: "short", detail: `Tren bearish (kekuatan ${trendStrength.toFixed(2)})` }
        : { name: "Trend", confirmed: false, direction: "neutral", detail: "Market ranging — tidak ada bias tren" };

  let srCheck: MethodCheck = { name: "Support/Resistance", confirmed: false, direction: "neutral", detail: "Harga tidak dekat level S/R" };
  for (const level of levels.slice(0, 5)) {
    if (Math.abs(currentPrice - level.price) < range * 3) {
      srCheck =
        level.type === "support"
          ? { name: "Support/Resistance", confirmed: true, direction: "long", detail: `Harga di support (${level.touches} sentuh, kekuatan ${level.strength.toFixed(2)})` }
          : { name: "Support/Resistance", confirmed: true, direction: "short", detail: `Harga di resistance (${level.touches} sentuh, kekuatan ${level.strength.toFixed(2)})` };
      break;
    }
  }

  let zoneCheck: MethodCheck = { name: "Supply/Demand", confirmed: false, direction: "neutral", detail: "Harga tidak di zona supply/demand" };
  for (const zone of zones) {
    if (currentPrice < zone.low - range * 2 || currentPrice > zone.high + range * 2) continue;
    if (zone.type === "demand" || zone.type === "bank_buy") {
      zoneCheck = { name: "Supply/Demand", confirmed: true, direction: "long", detail: `Harga di ${zone.label} (${px(zone.low)}–${px(zone.high)})` };
      break;
    }
    if (zone.type === "supply" || zone.type === "bank_sell") {
      zoneCheck = { name: "Supply/Demand", confirmed: true, direction: "short", detail: `Harga di ${zone.label} (${px(zone.low)}–${px(zone.high)})` };
      break;
    }
  }

  let bankCheck: MethodCheck = { name: "Bank/Institutional Zone", confirmed: false, direction: "neutral", detail: "Harga tidak di zona institusi" };
  for (const zone of zones.filter((item) => item.type === "bank_buy" || item.type === "bank_sell")) {
    if (currentPrice < zone.low - range * 2 || currentPrice > zone.high + range * 2) continue;
    bankCheck =
      zone.type === "bank_buy"
        ? { name: "Bank/Institutional Zone", confirmed: true, direction: "long", detail: `${zone.label} — akumulasi dekat lower band VWAP` }
        : { name: "Bank/Institutional Zone", confirmed: true, direction: "short", detail: `${zone.label} — distribusi dekat upper band VWAP` };
    break;
  }
  if (!bankCheck.confirmed) {
    if (currentPrice <= vwap.lowerBand + vwap.deviation * 0.2) {
      bankCheck = { name: "Bank/Institutional Zone", confirmed: true, direction: "long", detail: "Harga dekat lower band VWAP — area beli institusi" };
    } else if (currentPrice >= vwap.upperBand - vwap.deviation * 0.2) {
      bankCheck = { name: "Bank/Institutional Zone", confirmed: true, direction: "short", detail: "Harga dekat upper band VWAP — area jual institusi" };
    }
  }

  const sweep = signals.find((signal) => signal.type.includes("Liquidity Sweep"));
  let liqCheck: MethodCheck = { name: "Liquidity", confirmed: false, direction: "neutral", detail: "Tidak ada kolam likuiditas di dekat harga" };
  if (sweep) {
    liqCheck = { name: "Liquidity", confirmed: true, direction: sweep.direction, detail: sweep.description };
  } else {
    for (const pool of liquidity.slice(0, 3)) {
      if (Math.abs(currentPrice - pool.price) >= range * 3) continue;
      liqCheck =
        pool.type === "sellside"
          ? { name: "Liquidity", confirmed: true, direction: "long", detail: `${pool.label} di dekat harga — potensi sapu low lalu naik` }
          : { name: "Liquidity", confirmed: true, direction: "short", detail: `${pool.label} di dekat harga — potensi sapu high lalu turun` };
      break;
    }
  }

  const strong = signals.filter((signal) => signal.strength >= 0.6).sort((a, b) => b.strength - a.strength);
  const paCheck: MethodCheck = strong[0]
    ? { name: "Price Action", confirmed: true, direction: strong[0].direction, detail: `${strong[0].type}: ${strong[0].description}` }
    : { name: "Price Action", confirmed: false, direction: "neutral", detail: "Tidak ada sinyal price action yang kuat" };

  return [vwapCheck, trendCheck, srCheck, zoneCheck, bankCheck, liqCheck, paCheck];
}

export function confidenceScore(direction: Direction, methods: MethodCheck[], trend: Trend, trendStrength: number): number {
  const aligned = methods.filter((method) => method.confirmed && method.direction === direction);
  let score = (aligned.length / METHOD_COUNT) * 72;
  if (aligned.some((method) => method.name === "Price Action")) score += 8;
  if (aligned.some((method) => method.name === "Liquidity")) score += 6;
  const withTrend = (direction === "long" && trend === "bullish") || (direction === "short" && trend === "bearish");
  if (withTrend) score += 6 + Math.min(8, trendStrength * 20);
  return Math.max(32, Math.min(97, Math.round(score)));
}
export function placeRisk(
  direction: Direction,
  price: number,
  structuralEntry: number,
  structuralSl: number,
  avgRange: number,
  swingLow: number,
  swingHigh: number,
): { entry: number; sl: number } | null {
  const minRisk = Math.max(avgRange * 0.8, Math.abs(price) * 0.00005);
  let entry = structuralEntry;
  let sl = structuralSl;
  const risk = Math.abs(entry - sl);
  const onCorrectSide = direction === "long" ? sl < Math.min(price, entry) : sl > Math.max(price, entry);
  const near = Math.abs(price - entry) <= Math.max(risk, avgRange) * 1.25;
  const stillOpen =
    direction === "long" ? price > sl && price < entry + Math.max(risk, minRisk) : price < sl && price > entry - Math.max(risk, minRisk);

  if (!onCorrectSide || !near || !stillOpen || !(risk > 0)) {
    entry = price;
    if (direction === "long") {
      const swingStop = swingLow - avgRange * 0.25;
      sl = swingStop < price ? swingStop : price - minRisk;
      if (price - sl < minRisk) sl = price - minRisk;
    } else {
      const swingStop = swingHigh + avgRange * 0.25;
      sl = swingStop > price ? swingStop : price + minRisk;
      if (sl - price < minRisk) sl = price + minRisk;
    }
  } else if (risk < minRisk) {
    sl = direction === "long" ? entry - minRisk : entry + minRisk;
    if (direction === "long" && !(sl < price)) {
      entry = price;
      sl = price - minRisk;
    }
    if (direction === "short" && !(sl > price)) {
      entry = price;
      sl = price + minRisk;
    }
  }

  if (!(Math.abs(entry - sl) > 0) || !Number.isFinite(entry) || !Number.isFinite(sl)) return null;
  return { entry, sl };
}function buildPlan(market: MarketView, direction: Direction, votes: MethodCheck[]): SetupPlan | null {
  const spec = pairSpec(market.pair);
  const price = market.currentPrice;
  const recent = market.candles.slice(-10);
  const avgRange = recent.reduce((sum, candle) => sum + (candle.high - candle.low), 0) / Math.max(recent.length, 1);
  const swingLow = Math.min(...recent.map((candle) => candle.low));
  const swingHigh = Math.max(...recent.map((candle) => candle.high));
  let structuralEntry = price;
  let structuralSl = direction === "long" ? swingLow - avgRange * 0.5 : swingHigh + avgRange * 0.5;
  if (direction === "long") {
    const support = market.levels.filter((level) => level.type === "support" && level.price <= price).sort((a, b) => b.price - a.price)[0];
    const zone = market.zones
      .filter((item) => item.type === "demand" || item.type === "bank_buy")
      .sort((a, b) => Math.abs((a.high + a.low) / 2 - price) - Math.abs((b.high + b.low) / 2 - price))[0];
    structuralEntry = zone ? (zone.high + zone.low) / 2 : support ? support.price : price;
    structuralSl = zone ? zone.low - avgRange * 0.5 : support ? support.price - avgRange * 0.5 : swingLow - avgRange * 0.5;
    if (structuralSl >= structuralEntry) structuralSl = structuralEntry - avgRange * 1.5;
  } else {
    const resistance = market.levels
      .filter((level) => level.type === "resistance" && level.price >= price)
      .sort((a, b) => a.price - b.price)[0];
    const zone = market.zones
      .filter((item) => item.type === "supply" || item.type === "bank_sell")
      .sort((a, b) => Math.abs((a.high + a.low) / 2 - price) - Math.abs((b.high + b.low) / 2 - price))[0];
    structuralEntry = zone ? (zone.high + zone.low) / 2 : resistance ? resistance.price : price;
    structuralSl = zone ? zone.high + avgRange * 0.5 : resistance ? resistance.price + avgRange * 0.5 : swingHigh + avgRange * 0.5;
    if (structuralSl <= structuralEntry) structuralSl = structuralEntry + avgRange * 1.5;
  }
  const placed = placeRisk(direction, price, structuralEntry, structuralSl, avgRange, swingLow, swingHigh);
  if (!placed) return null;
  const { entry, sl } = placed;
  const risk = Math.abs(entry - sl);
  if (!(risk > 0) || !Number.isFinite(avgRange)) return null;
  const tp1 = direction === "long" ? entry + risk : entry - risk;
  const tp2 = direction === "long" ? entry + risk * 2 : entry - risk * 2;
  const tp3 = direction === "long" ? entry + risk * 3 : entry - risk * 3;
  const digits = spec.digits;
  const confidence = confidenceScore(direction, market.methods, market.trend, market.trendStrength);
  const names = votes.map((vote) => vote.name).join(", ");
  const lines = votes.map((vote) => `• ${vote.name}: ${vote.detail}`).join("\n");
  const side = direction === "long" ? "LONG" : "SHORT";
  return {
    pair: market.pair,
    timeframe: market.timeframe,
    direction,
    entry: roundTo(entry, digits),
    entryZoneLow: roundTo(entry - avgRange * 0.3, digits),
    entryZoneHigh: roundTo(entry + avgRange * 0.3, digits),
    sl: roundTo(sl, digits),
    tp1: roundTo(tp1, digits),
    tp2: roundTo(tp2, digits),
    tp3: roundTo(tp3, digits),
    methods: votes.map((vote) => vote.name),
    confluence: votes.length,
    confidence,
    methodDetails: votes.map((vote) => ({ ...vote })),
    pipsRisk: roundTo(risk / spec.pip, 1),
    riskReward: 1,
    rationale: `${side} ${market.pair} ${market.timeframe} dengan konfluensi ${votes.length} metode (${names}).\n\n${lines}\n\nEntry ${formatPrice(market.pair, entry)}\nSL ${formatPrice(market.pair, sl)}\nTP1 ${formatPrice(market.pair, tp1)} (1R)\nTP2 ${formatPrice(market.pair, tp2)} (2R)\nTP3 ${formatPrice(market.pair, tp3)} (3R)\n\nRencana: masuk di zona, SL di luar struktur. TP1 menggeser SL ke entry. TP2 menggeser SL ke TP1. Selesai di TP3 atau SL.`,
  };
}

export function analyzeMarket(pair: PairId, timeframe: Timeframe, candles: Candle[]): MarketView | null {
  if (candles.length < 40) return null;
  const used = candles.slice(-160);
  const vwap = vwapOf(used);
  const levels = swingLevels(used);
  const zones = [...supplyDemand(used), ...bankZones(used, vwap)];
  const liquidity = liquidityPools(used, levels);
  const signals = priceAction(used, levels, liquidity);
  const { trend, trendStrength } = trendOf(used);
  const market: MarketView = {
    pair,
    timeframe,
    candles: used,
    currentPrice: used[used.length - 1].close,
    vwap,
    levels,
    zones,
    liquidity,
    priceAction: signals,
    trend,
    trendStrength,
    methods: [],
  };
  market.methods = methodsOf(market);
  return market;
}

export function planFromMarket(market: MarketView): SetupPlan | null {
  const longs = market.methods.filter((method) => method.confirmed && method.direction === "long");
  const shorts = market.methods.filter((method) => method.confirmed && method.direction === "short");
  if (longs.length === shorts.length || Math.max(longs.length, shorts.length) < MIN_CONFLUENCE) return null;
  const direction: Direction = longs.length > shorts.length ? "long" : "short";
  return buildPlan(market, direction, direction === "long" ? longs : shorts);
}

export function isActionable(plan: SetupPlan, price: number): boolean {
  if (plan.direction === "long") return price > plan.sl && price < plan.tp1;
  return price < plan.sl && price > plan.tp1;
}

export function marketKey(pair: PairId, timeframe: Timeframe): string {
  return `${pair}_${timeframe}`;
}

function initialPhase(plan: SetupPlan, price: number): Phase {
  if (plan.direction === "long") return price < plan.entry ? "pending" : "live";
  return price > plan.entry ? "pending" : "live";
}

export function lockSetup(
  plan: SetupPlan,
  price: number,
  barTime: number,
  now: number,
  seen?: { high: number; low: number },
): LockedSetup {
  const phase = initialPhase(plan, price);
  return {
    ...plan,
    id: `${plan.pair}-${plan.timeframe}-${now}`,
    phase,
    lockedAt: now,
    filledAt: phase === "live" ? now : null,
    tp1HitAt: null,
    tp2HitAt: null,
    currentPrice: price,
    stopPrice: plan.sl,
    trackBar: barTime,
    trackHigh: seen ? Math.max(seen.high, price) : price,
    trackLow: seen ? Math.min(seen.low, price) : price,
  };
}

function closeTrade(setup: LockedSetup, outcome: CloseOutcome, exitPrice: number, now: number): ClosedTrade {
  const rMultiple = outcome === "sl" ? -1 : outcome === "be" ? 0 : outcome === "tp1" ? 1 : 3;
  const result = rMultiple > 0 ? "win" : rMultiple < 0 ? "loss" : "be";
  return {
    id: setup.id,
    pair: setup.pair,
    timeframe: setup.timeframe,
    direction: setup.direction,
    confidence: setup.confidence,
    confluence: setup.confluence,
    entry: setup.entry,
    sl: setup.sl,
    tp1: setup.tp1,
    tp2: setup.tp2,
    tp3: setup.tp3,
    methods: setup.methods,
    lockedAt: setup.lockedAt,
    closedAt: now,
    exitPrice,
    outcome,
    rMultiple,
    result,
  };
}

function outcomeLabel(outcome: CloseOutcome): string {
  if (outcome === "sl") return "SL";
  if (outcome === "be") return "BE di entry";
  if (outcome === "tp1") return "tertahan di TP1";
  return "TP3";
}

function noteForClose(setup: LockedSetup, closed: ClosedTrade): ActivityNote {
  const tone = closed.result === "win" ? "win" : closed.result === "loss" ? "loss" : "info";
  return {
    id: `${setup.id}-close-${closed.closedAt}`,
    at: closed.closedAt,
    tone,
    text: `${setup.pair} ${setup.timeframe} selesai · ${outcomeLabel(closed.outcome)} · ${closed.rMultiple}R · confidence ${setup.confidence}`,
  };
}

export function tickSetup(
  setup: LockedSetup,
  bar: Candle,
  price: number,
  now: number,
): { setup: LockedSetup | null; closed?: ClosedTrade; note?: ActivityNote } {
  let trackBar = setup.trackBar;
  let trackHigh = setup.trackHigh;
  let trackLow = setup.trackLow;
  let excursionHigh = price;
  let excursionLow = price;
  if (bar.time !== setup.trackBar) {
    excursionHigh = Math.max(bar.high, price);
    excursionLow = Math.min(bar.low, price);
    trackBar = bar.time;
    trackHigh = excursionHigh;
    trackLow = excursionLow;
  } else {
    const peak = Math.max(bar.high, price);
    const trough = Math.min(bar.low, price);
    excursionHigh = peak > setup.trackHigh ? peak : price;
    excursionLow = trough < setup.trackLow ? trough : price;
    trackHigh = Math.max(setup.trackHigh, peak);
    trackLow = Math.min(setup.trackLow, trough);
  }

  let phase = setup.phase;
  let stopPrice = setup.stopPrice;
  let filledAt = setup.filledAt;
  let tp1HitAt = setup.tp1HitAt;
  let tp2HitAt = setup.tp2HitAt;
  const long = setup.direction === "long";

  if (phase === "pending") {
    const filled = long ? excursionLow <= setup.entry : excursionHigh >= setup.entry;
    const invalidated = long ? excursionLow <= setup.sl : excursionHigh >= setup.sl;
    if (!filled) {
      if (invalidated || (long ? excursionHigh >= setup.tp1 : excursionLow <= setup.tp1)) {
        return {
          setup: null,
          note: { id: `${setup.id}-void-${now}`, at: now, tone: "info", text: `${setup.pair} ${setup.timeframe} batal sebelum entry — slot dibuka lagi` },
        };
      }
      return { setup: { ...setup, currentPrice: price, trackBar, trackHigh, trackLow } };
    }
    phase = "live";
    filledAt = now;
    if (long ? excursionLow <= setup.sl : excursionHigh >= setup.sl) {
      const closed = closeTrade(setup, "sl", setup.sl, now);
      return { setup: null, closed, note: noteForClose(setup, closed) };
    }
  }

  if (long ? excursionLow <= stopPrice : excursionHigh >= stopPrice) {
    const outcome: CloseOutcome = phase === "live" ? "sl" : phase === "tp1" ? "be" : "tp1";
    const closed = closeTrade({ ...setup, phase }, outcome, stopPrice, now);
    return { setup: null, closed, note: noteForClose(setup, closed) };
  }

  if (long ? excursionHigh >= setup.tp3 : excursionLow <= setup.tp3) {
    const closed = closeTrade(setup, "tp3", setup.tp3, now);
    return { setup: null, closed, note: noteForClose(setup, closed) };
  }

  let note: ActivityNote | undefined;
  if (phase !== "tp2" && (long ? excursionHigh >= setup.tp2 : excursionLow <= setup.tp2)) {
    phase = "tp2";
    stopPrice = setup.tp1;
    tp2HitAt = tp2HitAt ?? now;
    tp1HitAt = tp1HitAt ?? now;
    note = { id: `${setup.id}-tp2-${now}`, at: now, tone: "info", text: `${setup.pair} ${setup.timeframe} TP2 — SL dikunci di TP1` };
  } else if (phase === "live" && (long ? excursionHigh >= setup.tp1 : excursionLow <= setup.tp1)) {
    phase = "tp1";
    stopPrice = setup.entry;
    tp1HitAt = now;
    note = { id: `${setup.id}-tp1-${now}`, at: now, tone: "info", text: `${setup.pair} ${setup.timeframe} TP1 — SL dikunci di entry` };
  }

  return {
    setup: { ...setup, phase, stopPrice, filledAt, tp1HitAt, tp2HitAt, currentPrice: price, trackBar, trackHigh, trackLow },
    note,
  };
}

export function quoteIsFresh(time: number, now: number): boolean {
  return time > 0 && now - time <= 45_000 && time - now <= 15_000;
}

export function selectLocks(
  running: { pair: PairId; timeframe: Timeframe }[],
  plans: SetupPlan[],
  paused: boolean,
): { lock: SetupPlan[]; hold: { plan: SetupPlan; note: string }[] } {
  const busy = new Set(running.map((setup) => setup.pair));
  const grouped = new Map<PairId, SetupPlan[]>();
  for (const plan of plans) {
    const list = grouped.get(plan.pair) ?? [];
    list.push(plan);
    grouped.set(plan.pair, list);
  }
  const lock: SetupPlan[] = [];
  const hold: { plan: SetupPlan; note: string }[] = [];
  for (const [pair, list] of grouped) {
    const ranked = list
      .slice()
      .sort((a, b) => b.confidence - a.confidence || b.confluence - a.confluence || (a.timeframe === "M15" ? -1 : 1));
    if (paused || busy.has(pair)) {
      const note = paused ? "Kunci dijeda — kandidat tetap dipantau" : "Slot pair terkunci sampai TP/SL — kandidat latar";
      for (const plan of ranked) hold.push({ plan, note });
      continue;
    }
    lock.push(ranked[0]);
    for (const plan of ranked.slice(1)) {
      hold.push({
        plan,
        note: `Di bawah setup terbaik ${pair} (${ranked[0].timeframe} · ${ranked[0].confidence})`,
      });
    }
  }
  return { lock, hold };
}

export function watchLean(market: MarketView): RadarItem | null {
  const longs = market.methods.filter((method) => method.confirmed && method.direction === "long");
  const shorts = market.methods.filter((method) => method.confirmed && method.direction === "short");
  if (longs.length === shorts.length) return null;
  const direction: Direction = longs.length > shorts.length ? "long" : "short";
  const votes = direction === "long" ? longs : shorts;
  if (votes.length < 2 || votes.length >= MIN_CONFLUENCE) return null;
  return {
    pair: market.pair,
    timeframe: market.timeframe,
    direction,
    confidence: confidenceScore(direction, market.methods, market.trend, market.trendStrength),
    confluence: votes.length,
    status: "watch",
    note: `${votes.length}/7 metode searah — belum dikunci`,
  };
}

export type ScreenResult = {
  running: LockedSetup[];
  radar: RadarItem[];
  closed: ClosedTrade[];
  notes: ActivityNote[];
  markets: Record<string, MarketView>;
};

export function screenBook(
  quotes: { pair: PairId; candles: Candle[]; price: number; time: number }[],
  running: LockedSetup[],
  options: { paused: boolean; now: number },
): ScreenResult {
  const markets: Record<string, MarketView> = {};
  const closed: ClosedTrade[] = [];
  const notes: ActivityNote[] = [];
  const next = running.map((setup) => ({ ...setup }));
  const actionable: { plan: SetupPlan; barTime: number; high: number; low: number }[] = [];
  const radar: RadarItem[] = [];

  for (const quote of quotes) {
    if (!quoteIsFresh(quote.time, options.now) || !Number.isFinite(quote.price) || quote.price <= 0) continue;
    for (const timeframe of ["M5", "M15"] as const) {
      const series = timeframe === "M5" ? quote.candles : resample(quote.candles, 15);
      if (series.length === 0) continue;
      const last = series[series.length - 1];
      const bar: Candle = {
        ...last,
        close: quote.price,
        high: Math.max(last.high, quote.price),
        low: Math.min(last.low, quote.price),
      };
      const index = next.findIndex((setup) => setup.pair === quote.pair && setup.timeframe === timeframe);
      if (index >= 0) {
        const stepped = tickSetup(next[index], bar, quote.price, options.now);
        if (stepped.note) notes.push(stepped.note);
        if (stepped.closed) closed.push(stepped.closed);
        if (stepped.setup) next[index] = stepped.setup;
        else next.splice(index, 1);
      }
      if (quote.candles.length < 40) continue;
      const priced = [
        ...series.slice(0, -1),
        { ...last, close: quote.price, high: Math.max(last.high, quote.price), low: Math.min(last.low, quote.price) },
      ];
      const market = analyzeMarket(quote.pair, timeframe, priced);
      if (!market) continue;
      markets[marketKey(quote.pair, timeframe)] = market;
      const plan = planFromMarket(market);
      if (!plan) {
        const lean = watchLean(market);
        if (lean) radar.push(lean);
        continue;
      }
      if (!isActionable(plan, quote.price)) {
        radar.push({
          pair: plan.pair,
          timeframe: plan.timeframe,
          direction: plan.direction,
          confidence: plan.confidence,
          confluence: plan.confluence,
          status: "late",
          note: "Harga sudah lewat zona — tidak dikunci",
        });
        continue;
      }
      actionable.push({ plan, barTime: bar.time, high: bar.high, low: bar.low });
    }
  }

  const chosen = selectLocks(next, actionable.map((item) => item.plan), options.paused);
  const byKey = new Map(actionable.map((item) => [marketKey(item.plan.pair, item.plan.timeframe), item]));
  for (const plan of chosen.lock) {
    const ctx = byKey.get(marketKey(plan.pair, plan.timeframe));
    const live = quotes.find((quote) => quote.pair === plan.pair);
    if (!ctx || !live) continue;
    const locked = lockSetup(plan, live.price, ctx.barTime, options.now, { high: ctx.high, low: ctx.low });
    next.push(locked);
    notes.push({
      id: `${locked.id}-lock`,
      at: options.now,
      tone: "lock",
      text: `Terkunci ${locked.pair} ${locked.timeframe} ${locked.direction === "long" ? "LONG" : "SHORT"} · confidence ${locked.confidence} · ${locked.confluence}/7`,
    });
  }
  for (const item of chosen.hold) {
    if (next.some((setup) => setup.pair === item.plan.pair && setup.timeframe === item.plan.timeframe)) continue;
    radar.push({
      pair: item.plan.pair,
      timeframe: item.plan.timeframe,
      direction: item.plan.direction,
      confidence: item.plan.confidence,
      confluence: item.plan.confluence,
      status: "queued",
      note: item.note,
    });
  }

  const rank: Record<RadarStatus, number> = { queued: 0, late: 1, watch: 2 };
  radar.sort((a, b) => rank[a.status] - rank[b.status] || b.confidence - a.confidence || b.confluence - a.confluence);
  return { running: next, radar, closed, notes, markets };
}

export function summarize(history: ClosedTrade[]) {
  const wins = history.filter((trade) => trade.result === "win").length;
  const losses = history.filter((trade) => trade.result === "loss").length;
  const breakeven = history.filter((trade) => trade.result === "be").length;
  const decisive = wins + losses;
  const rate = decisive > 0 ? wins / decisive : null;
  const avgR = history.length > 0 ? history.reduce((sum, trade) => sum + trade.rMultiple, 0) / history.length : null;
  return { wins, losses, breakeven, rate, avgR, closed: history.length };
}

import { PAIRS, type PairId } from "./pairs.ts";
import { applyExtreme, shiftToSpot, spotFits } from "./live-price.ts";
import type { Candle } from "./screening.ts";

export type PairQuote = {
  pair: PairId;
  price: number;
  time: number;
  previousClose: number | null;
  candles: Candle[];
  source: string;
  error?: string;
};

export type QuoteBook = {
  asOf: number;
  ok: boolean;
  pairs: PairQuote[];
};

const CANDLE_TTL_MS = 20_000;
const BOOK_TTL_MS = 2_500;
const SPOT_PATH: Record<PairId, string> = {
  XAUUSD: "XAU/USD",
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
};

type RawSeries = {
  at: number;
  candles: Candle[];
  previousClose: number | null;
  yahooPrice: number;
  yahooTime: number;
};

type Spot = { price: number; time: number };

const rawCache = new Map<PairId, RawSeries>();
const extremes = new Map<PairId, { bucket: number; high: number; low: number }>();
let bookCache: { at: number; book: QuoteBook } | null = null;

type YahooChart = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
      meta?: {
        regularMarketPrice?: number;
        regularMarketTime?: number;
        chartPreviousClose?: number;
        previousClose?: number;
      };
    }>;
    error?: { description?: string };
  };
};

type SwissProfile = { spreadProfile?: string; bid?: number; ask?: number };
type SwissRow = { ts?: number; spreadProfilePrices?: SwissProfile[] };

function rememberExtreme(pair: PairId, price: number, time: number) {
  const bucket = Math.floor(time / 300_000) * 300_000;
  const prev = extremes.get(pair);
  if (!prev || prev.bucket !== bucket) {
    const next = { bucket, high: price, low: price };
    extremes.set(pair, next);
    return next;
  }
  prev.high = Math.max(prev.high, price);
  prev.low = Math.min(prev.low, price);
  return prev;
}

async function fetchRaw(id: PairId, yahoo: string): Promise<RawSeries> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=5m&range=5d&includePrePost=true`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as YahooChart;
  const result = body.chart?.result?.[0];
  if (!result) throw new Error(body.chart?.error?.description || "tidak ada data");
  const times = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) throw new Error("quote kosong");
  const candles: Candle[] = [];
  for (let i = 0; i < times.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({
      time: times[i] * 1000,
      open,
      high,
      low,
      close,
      volume: quote.volume?.[i] ?? 0,
    });
  }
  if (candles.length < 40) throw new Error("candle kurang");
  const trimmed = candles.slice(-240);
  const price = result.meta?.regularMarketPrice ?? trimmed[trimmed.length - 1].close;
  const time = (result.meta?.regularMarketTime ?? times[times.length - 1]) * 1000;
  return {
    at: Date.now(),
    candles: trimmed,
    previousClose: result.meta?.previousClose ?? result.meta?.chartPreviousClose ?? null,
    yahooPrice: price,
    yahooTime: time,
  };
}

async function ensureRaw(id: PairId, yahoo: string, now: number): Promise<RawSeries | null> {
  const cached = rawCache.get(id);
  if (cached && now - cached.at < CANDLE_TTL_MS && cached.candles.length >= 40) return cached;
  try {
    const fresh = await fetchRaw(id, yahoo);
    rawCache.set(id, fresh);
    return fresh;
  } catch {
    return cached ?? null;
  }
}

function spotFromSwiss(body: unknown): Spot | null {
  if (!Array.isArray(body)) return null;
  let best: { price: number; time: number; spread: number } | null = null;
  for (const row of body as SwissRow[]) {
    const profiles = row.spreadProfilePrices;
    if (!Array.isArray(profiles)) continue;
    const picked =
      profiles.find((profile) => profile.spreadProfile === "elite") ??
      profiles.find((profile) => profile.spreadProfile === "prime") ??
      profiles[0];
    const bid = Number(picked?.bid);
    const ask = Number(picked?.ask);
    const ts = Number(row.ts);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) continue;
    const time = ts > 1e12 ? ts : ts > 1e9 ? ts * 1000 : Date.now();
    const spread = ask - bid;
    const price = (bid + ask) / 2;
    if (!best || spread < best.spread) best = { price, time, spread };
  }
  return best ? { price: best.price, time: best.time } : null;
}

async function fetchSwiss(pair: PairId): Promise<Spot | null> {
  try {
    const response = await fetch(`https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${SPOT_PATH[pair]}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return spotFromSwiss(await response.json());
  } catch {
    return null;
  }
}

async function fetchGoldFallback(): Promise<Spot | null> {
  try {
    const response = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { price?: number; updatedAt?: string };
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) return null;
    const parsed = body.updatedAt ? Date.parse(body.updatedAt) : Date.now();
    return { price, time: Number.isFinite(parsed) ? parsed : Date.now() };
  } catch {
    return null;
  }
}

async function fetchSpots(): Promise<Map<PairId, Spot>> {
  const entries = await Promise.all(
    PAIRS.map(async (spec) => [spec.id, await fetchSwiss(spec.id)] as const),
  );
  const spots = new Map<PairId, Spot>();
  for (const [id, spot] of entries) {
    if (spot) spots.set(id, spot);
  }
  if (!spots.has("XAUUSD")) {
    const fallback = await fetchGoldFallback();
    if (fallback) spots.set("XAUUSD", fallback);
  }
  return spots;
}

function sourceFor(pair: PairId, usedSpot: boolean): string {
  if (pair === "XAUUSD") return usedSpot ? "XAUUSD spot" : "COMEX tertunda";
  return usedSpot ? "Spot live" : "Yahoo FX";
}

export async function fetchQuoteBook(): Promise<QuoteBook> {
  const now = Date.now();
  if (bookCache && now - bookCache.at < BOOK_TTL_MS) return bookCache.book;

  const [, spots] = await Promise.all([
    Promise.all(PAIRS.map((spec) => ensureRaw(spec.id, spec.yahoo, now))),
    fetchSpots(),
  ]);

  const pairs: PairQuote[] = PAIRS.map((spec) => {
    const raw = rawCache.get(spec.id);
    if (!raw || raw.candles.length < 40) {
      return {
        pair: spec.id,
        price: 0,
        time: 0,
        previousClose: null,
        candles: [],
        source: spec.source,
        error: "harga belum masuk",
      };
    }
    const spot = spots.get(spec.id) ?? null;
    const lastClose = raw.candles[raw.candles.length - 1].close;
    const usedSpot = Boolean(spot && spotFits(spec.id, lastClose, spot.price));
    const price = usedSpot && spot ? spot.price : raw.yahooPrice;
    const time = usedSpot && spot ? spot.time : raw.yahooTime;
    const shifted = shiftToSpot(raw.candles, price, raw.previousClose);
    const candles = applyExtreme(shifted.candles, price, time, rememberExtreme(spec.id, price, time));
    return {
      pair: spec.id,
      price,
      time,
      previousClose: shifted.previousClose,
      candles,
      source: sourceFor(spec.id, usedSpot),
    };
  });

  const book: QuoteBook = {
    asOf: now,
    ok: pairs.some((pair) => !pair.error && pair.candles.length >= 40 && pair.price > 0),
    pairs,
  };
  if (book.ok) bookCache = { at: now, book };
  return book;
}

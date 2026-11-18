import { create } from "zustand";
import type { PairId, Timeframe } from "@/lib/pairs";
import { applyExtreme } from "@/lib/live-price";
import {
  screenBook,
  type ActivityNote,
  type Candle,
  type ClosedTrade,
  type LockedSetup,
  type MarketView,
  type RadarItem,
} from "@/lib/screening";
import type { QuoteBook } from "@/lib/yahoo-quotes";

const STORAGE_KEY = "meja-screening-v1";

type Persisted = {
  running: LockedSetup[];
  history: ClosedTrade[];
  paused: boolean;
};

export type DeskState = {
  book: QuoteBook | null;
  markets: Record<string, MarketView>;
  running: LockedSetup[];
  radar: RadarItem[];
  history: ClosedTrade[];
  activity: ActivityNote[];
  paused: boolean;
  hydrated: boolean;
  scans: number;
  hydrate: () => void;
  setPaused: (paused: boolean) => void;
  ingest: (book: QuoteBook) => void;
};

const sessionExtremes = new Map<PairId, { bucket: number; high: number; low: number }>();

function withSession(pair: PairId, candles: Candle[], price: number, time: number): Candle[] {
  const bucket = Math.floor(time / 300_000) * 300_000;
  const prev = sessionExtremes.get(pair);
  const extreme =
    !prev || prev.bucket !== bucket
      ? { bucket, high: price, low: price }
      : { bucket, high: Math.max(prev.high, price), low: Math.min(prev.low, price) };
  sessionExtremes.set(pair, extreme);
  return applyExtreme(candles, price, time, extreme);
}

function readPersisted(): Persisted | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (!Array.isArray(parsed.running) || !Array.isArray(parsed.history)) return null;
    return {
      running: parsed.running,
      history: parsed.history.slice(0, 80),
      paused: Boolean(parsed.paused),
    };
  } catch {
    return null;
  }
}

function writePersisted(state: Persisted) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        running: state.running,
        history: state.history.slice(0, 80),
        paused: state.paused,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

export const useDesk = create<DeskState>((set, get) => ({
  book: null,
  markets: {},
  running: [],
  radar: [],
  history: [],
  activity: [],
  paused: false,
  hydrated: false,
  scans: 0,
  hydrate: () => {
    if (get().hydrated) return;
    const saved = readPersisted();
    set({
      hydrated: true,
      running: saved?.running ?? [],
      history: saved?.history ?? [],
      paused: saved?.paused ?? false,
    });
  },
  setPaused: (paused) => {
    set({ paused });
    const state = get();
    writePersisted({ running: state.running, history: state.history, paused });
  },
  ingest: (book) => {
    const state = get();
    const quotes = book.pairs
      .filter((pair) => pair.candles.length >= 40 && Number.isFinite(pair.price) && pair.price > 0)
      .map((pair) => {
        const time = pair.time || book.asOf;
        return {
          pair: pair.pair,
          candles: withSession(pair.pair, pair.candles, pair.price, time),
          price: pair.price,
          time,
        };
      });
    const screened = screenBook(quotes, state.hydrated ? state.running : state.running, {
      paused: state.paused,
      now: book.asOf,
    });
    const history = [...screened.closed, ...state.history].slice(0, 80);
    const activity = [...screened.notes, ...state.activity].slice(0, 24);
    set({
      book,
      markets: screened.markets,
      running: screened.running,
      radar: screened.radar,
      history,
      activity,
      scans: state.scans + 1,
    });
    if (state.hydrated) {
      writePersisted({ running: screened.running, history, paused: state.paused });
    }
  },
}));

export function quoteFor(book: QuoteBook | null, pair: PairId) {
  return book?.pairs.find((item) => item.pair === pair) ?? null;
}

export function marketFor(markets: Record<string, MarketView>, pair: PairId, timeframe: Timeframe) {
  return markets[`${pair}_${timeframe}`] ?? null;
}

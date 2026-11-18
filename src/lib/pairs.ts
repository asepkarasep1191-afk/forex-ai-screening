export type PairId = "XAUUSD" | "USDJPY" | "GBPUSD" | "EURUSD";
export type Timeframe = "M5" | "M15";

export type PairSpec = {
  id: PairId;
  label: string;
  digits: number;
  pip: number;
  yahoo: string;
  source: string;
};

export const PAIRS: PairSpec[] = [
  {
    id: "XAUUSD",
    label: "Gold / US Dollar",
    digits: 2,
    pip: 0.1,
    yahoo: "GC=F",
    source: "XAUUSD spot",
  },
  {
    id: "USDJPY",
    label: "US Dollar / Yen",
    digits: 3,
    pip: 0.01,
    yahoo: "USDJPY=X",
    source: "Yahoo FX",
  },
  {
    id: "GBPUSD",
    label: "Pound / US Dollar",
    digits: 5,
    pip: 0.0001,
    yahoo: "GBPUSD=X",
    source: "Yahoo FX",
  },
  {
    id: "EURUSD",
    label: "Euro / US Dollar",
    digits: 5,
    pip: 0.0001,
    yahoo: "EURUSD=X",
    source: "Yahoo FX",
  },
];

export const TIMEFRAMES: Timeframe[] = ["M5", "M15"];

export function pairSpec(id: PairId): PairSpec {
  const found = PAIRS.find((pair) => pair.id === id);
  if (!found) throw new Error(`Unknown pair ${id}`);
  return found;
}

export function formatPrice(id: PairId, value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(pairSpec(id).digits);
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

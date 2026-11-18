import type { PairId } from "@/lib/pairs";
import { formatPrice } from "@/lib/pairs";
import type { Candle } from "@/lib/screening";

type LevelLine = {
  price: number;
  label: string;
  tone: "entry" | "sl" | "tp" | "live";
};

type CandleChartProps = {
  candles: Candle[];
  pair: PairId;
  levels?: LevelLine[];
};

export function CandleChart({ candles, pair, levels = [] }: CandleChartProps) {
  const view = candles.slice(-72);
  if (view.length < 2) {
    return <p className="px-4 py-16 text-center text-sm text-muted">Candle realtime belum cukup.</p>;
  }
  const prices = [
    ...view.flatMap((candle) => [candle.high, candle.low]),
    ...levels.map((level) => level.price),
  ];
  const hi = Math.max(...prices);
  const lo = Math.min(...prices);
  const span = hi - lo || Math.abs(hi) * 0.001 || 1;
  const y = (price: number) => ((hi - price) / span) * 100;
  const width = 100 / view.length;

  return (
    <div className="relative h-64 w-full">
      <div className="absolute inset-x-0 top-0 border-t border-rule/80" />
      <div className="absolute inset-x-0 top-1/2 border-t border-rule/80" />
      <div className="absolute inset-x-0 bottom-0 border-t border-rule/80" />
      {levels.map((level) => (
        <div key={`${level.label}-${level.price}`} className="absolute inset-x-0" style={{ top: `${y(level.price)}%` }}>
          <div
            className={
              level.tone === "sl"
                ? "border-t border-short"
                : level.tone === "tp"
                  ? "border-t border-long"
                  : level.tone === "live"
                    ? "border-t border-paper"
                    : "border-t border-brass"
            }
          />
          <span
            className={
              "absolute right-0 -translate-y-1/2 px-1 font-mono text-xs " +
              (level.tone === "sl" ? "text-short" : level.tone === "tp" ? "text-long" : level.tone === "live" ? "text-paper" : "text-brass")
            }
          >
            {level.label} {formatPrice(pair, level.price)}
          </span>
        </div>
      ))}
      {view.map((candle, index) => {
        const up = candle.close >= candle.open;
        const top = y(Math.max(candle.open, candle.close));
        const bottom = y(Math.min(candle.open, candle.close));
        const body = Math.max(bottom - top, 0.6);
        return (
          <div key={candle.time} className="absolute inset-y-0" style={{ left: `${index * width}%`, width: `${width}%` }}>
            <div
              className={"absolute left-1/2 w-px -translate-x-1/2 " + (up ? "bg-long" : "bg-short")}
              style={{ top: `${y(candle.high)}%`, height: `${Math.max(y(candle.low) - y(candle.high), 0.4)}%` }}
            />
            <div
              className={"absolute " + (up ? "bg-long" : "bg-short")}
              style={{ top: `${top}%`, height: `${body}%`, left: "22%", right: "22%" }}
            />
          </div>
        );
      })}
    </div>
  );
}

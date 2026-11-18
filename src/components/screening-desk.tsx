import { useEffect, useMemo, useState } from "react";
import { Activity, Lock, Pause, Play, Radar, Shield } from "lucide-react";
import { CandleChart } from "@/components/candle-chart";
import { marketFor, quoteFor, useDesk } from "@/lib/desk-store";
import { PAIRS, TIMEFRAMES, formatPrice, type PairId, type Timeframe } from "@/lib/pairs";
import { getQuotes } from "@/lib/quotes";
import { analyzeMarket, quoteIsFresh, resample, summarize, type ClosedTrade, type LockedSetup, type RadarItem } from "@/lib/screening";
import type { QuoteBook } from "@/lib/yahoo-quotes";

const POLL_MS = 5000;

function phaseLabel(setup: LockedSetup): string {
  if (setup.phase === "pending") return "Menunggu entry";
  if (setup.phase === "tp1") return "TP1 · SL di entry";
  if (setup.phase === "tp2") return "TP2 · SL di TP1";
  return "Berjalan";
}

function outcomeText(trade: ClosedTrade): string {
  if (trade.outcome === "sl") return "SL";
  if (trade.outcome === "be") return "BE";
  if (trade.outcome === "tp1") return "TP1";
  return "TP3";
}

function formatWhen(time: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(time);
}

function ageLabel(time: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 90) return `${seconds} dtk`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} mnt`;
  return `${Math.round(minutes / 60)} jam`;
}

export function ScreeningDesk({ initial }: { initial: QuoteBook }) {
  const desk = useDesk();
  const [pair, setPair] = useState<PairId>("XAUUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("M15");
  const [openId, setOpenId] = useState<string | null>(null);
  const [clock, setClock] = useState<number | null>(null);

  useEffect(() => {
    const store = useDesk.getState();
    store.hydrate();
    store.ingest(initial);
    setClock(Date.now());
    const clockId = setInterval(() => setClock(Date.now()), 1000);
    let stopped = false;
    let timer = 0;
    const poll = async () => {
      try {
        const book = await getQuotes();
        if (!stopped) useDesk.getState().ingest(book);
      } catch {
        /* next tick retries; last book stays on screen */
      } finally {
        if (!stopped) timer = window.setTimeout(poll, POLL_MS);
      }
    };
    timer = window.setTimeout(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(clockId);
    };
  }, [initial]);

  const book = desk.book ?? initial;
  const quote = quoteFor(book, pair);
  const storedMarket = marketFor(desk.markets, pair, timeframe);
  const fallbackMarket = useMemo(() => {
    if (!quote || quote.candles.length < 40 || quote.price <= 0) return null;
    const series = timeframe === "M15" ? resample(quote.candles, 15) : quote.candles;
    const last = series[series.length - 1];
    if (!last) return null;
    const priced = [
      ...series.slice(0, -1),
      { ...last, close: quote.price, high: Math.max(last.high, quote.price), low: Math.min(last.low, quote.price) },
    ];
    return analyzeMarket(pair, timeframe, priced);
  }, [quote, pair, timeframe]);
  const market = storedMarket ?? fallbackMarket;
  const stats = summarize(desk.history);
  const selectedLocked = desk.running.find((setup) => setup.pair === pair && setup.timeframe === timeframe) ?? null;
  const rawCandles = quote?.candles ?? [];
  const chartCandles = market?.candles ?? (timeframe === "M15" ? resample(rawCandles, 15) : rawCandles);
  const livePrice = quote && quote.price > 0 ? quote.price : null;
  const change = quote && quote.previousClose && livePrice ? ((livePrice - quote.previousClose) / quote.previousClose) * 100 : null;
  const now = clock ?? book.asOf;
  const freshStamps = book.pairs.map((item) => item.time).filter((time) => time > 0);
  const oldestStamp = freshStamps.length > 0 ? Math.min(...freshStamps) : book.asOf;

  const levels = selectedLocked
    ? [
        { price: selectedLocked.entry, label: "Entry", tone: "entry" as const },
        { price: selectedLocked.stopPrice, label: "SL", tone: "sl" as const },
        { price: selectedLocked.tp1, label: "TP1", tone: "tp" as const },
        { price: selectedLocked.tp2, label: "TP2", tone: "tp" as const },
        { price: selectedLocked.tp3, label: "TP3", tone: "tp" as const },
      ]
    : livePrice
      ? [{ price: livePrice, label: "Live", tone: "live" as const }]
      : [];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-brass">NORTH DESK</p>
          <h1 className="text-2xl font-semibold text-paper">Meja Screening</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            XAUUSD, USDJPY, GBPUSD, EURUSD. Setup terbaik tiap pair dikunci beserta confidence-nya sampai kena TP atau SL. Scanner tetap mencari di belakang.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-sm text-paper">{clock ? formatWhen(clock) : "WIB"}</p>
            <p className="text-xs text-muted">
              {book.ok
                ? `Harga spot · tertua ${ageLabel(oldestStamp, now)}`
                : "Harga belum masuk"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !useDesk.getState().paused;
              useDesk.getState().setPaused(next);
              const current = useDesk.getState().book;
              if (current) useDesk.getState().ingest(current);
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-card border border-rule bg-panel px-3 text-sm text-paper"
          >
            {desk.paused ? <Play className="size-4 text-brass" /> : <Pause className="size-4 text-brass" />}
            {desk.paused ? "Lanjut kunci" : "Jeda kunci"}
          </button>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Winrate" value={stats.rate == null ? "—" : `${Math.round(stats.rate * 100)}%`} hint="Menang / (menang + kalah). BE di luar." />
        <Stat label="Selesai" value={`${stats.wins}M ${stats.losses}K`} hint={`${stats.breakeven} BE · ${stats.closed} tercatat`} />
        <Stat label="R rata-rata" value={stats.avgR == null ? "—" : `${stats.avgR > 0 ? "+" : ""}${stats.avgR.toFixed(2)}R`} hint="Termasuk BE dan SL" />
        <Stat label="Terkunci" value={String(desk.running.length)} hint={desk.paused ? "Kunci baru dijeda" : `${desk.scans} sapuan live`} />
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {PAIRS.map((spec) => {
          const row = quoteFor(book, spec.id);
          const active = pair === spec.id;
          const px = row && row.price > 0 ? row.price : null;
          const delta = row?.previousClose && px ? ((px - row.previousClose) / row.previousClose) * 100 : null;
          const locked = desk.running.some((setup) => setup.pair === spec.id);
          const fresh = row ? quoteIsFresh(row.time, now) : false;
          const wr = summarize(desk.history.filter((trade) => trade.pair === spec.id));
          const wrText = wr.closed === 0 ? "WR —" : wr.rate == null ? `WR — · ${wr.closed}` : `WR ${Math.round(wr.rate * 100)}% · ${wr.closed}`;
          return (
            <button
              key={spec.id}
              type="button"
              onClick={() => setPair(spec.id)}
              className={
                "min-h-11 rounded-card border px-3 py-2 text-left " +
                (active ? "border-brass bg-raised" : "border-rule bg-panel")
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-paper">{spec.id}</span>
                {locked ? <Lock className="size-4 text-brass" /> : null}
              </span>
              <span className={"mt-1 block font-mono text-lg " + ((delta ?? 0) >= 0 ? "text-long" : "text-short")}>
                {px == null ? "—" : formatPrice(spec.id, px)}
              </span>
              <span className="block text-xs text-muted">
                {row?.error
                  ? row.error
                  : `${delta == null ? row?.source ?? spec.source : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% · ${row?.source ?? spec.source}`} · ${fresh ? "live" : "tertunda"}`}
              </span>
              <span className="block text-xs text-muted">{wrText}</span>
            </button>
          );
        })}
      </section>

      {!book.ok ? (
        <p className="rounded-card border border-short/50 bg-panel px-4 py-3 text-sm text-short">
          Harga realtime gagal dimuat. Screening tidak memakai data simulasi.
        </p>
      ) : null}
      {book.ok && book.pairs.some((item) => item.price > 0 && !quoteIsFresh(item.time, now)) ? (
        <p className="rounded-card border border-brass/40 bg-panel px-4 py-3 text-sm text-brass">
          Ada pair yang harganya tertunda. Setup pair itu tidak dikunci dan tidak digeser sampai tick-nya segar lagi.
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 rounded-card border border-rule bg-panel lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3">
            <div>
              <h2 className="font-mono text-sm text-paper">
                {pair} · {timeframe}
              </h2>
              <p className="text-xs text-muted">
                {livePrice == null ? "Menunggu tick" : formatPrice(pair, livePrice)}
                {change == null ? "" : ` · ${change >= 0 ? "+" : ""}${change.toFixed(2)}% hari ini`}
                {market ? ` · tren ${market.trend}` : ""}
              </p>
            </div>
            <div className="flex rounded-card border border-rule p-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={
                    "min-h-11 rounded-md px-3 font-mono text-sm " +
                    (timeframe === tf ? "bg-raised text-paper" : "text-muted")
                  }
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <CandleChart candles={chartCandles} pair={pair} levels={levels} />
          <ul className="grid gap-2 border-t border-rule p-3 sm:grid-cols-2">
            {(market?.methods ?? []).map((method) => (
              <li key={method.name} className="rounded-md border border-rule bg-ink px-3 py-2">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm text-paper">{method.name}</span>
                  <span className={"font-mono text-xs " + (method.confirmed ? (method.direction === "long" ? "text-long" : "text-short") : "text-muted")}>
                    {method.confirmed ? method.direction.toUpperCase() : "—"}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-muted">{method.detail}</span>
              </li>
            ))}
            {!market ? <li className="text-sm text-muted">Metode dihitung dari candle live begitu sapuan pertama selesai.</li> : null}
          </ul>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-brass" />
            <h2 className="text-sm font-semibold text-paper">Setup terkunci</h2>
          </div>
          {desk.running.length === 0 ? (
            <p className="rounded-card border border-dashed border-rule px-4 py-6 text-sm text-muted">
              Belum ada yang lolos. Scanner tetap membaca keempat pair di M5 dan M15.
            </p>
          ) : (
            desk.running
              .slice()
              .sort((a, b) => b.confidence - a.confidence)
              .map((setup) => (
                <LockedCard
                  key={setup.id}
                  setup={setup}
                  open={openId === setup.id}
                  onToggle={() => {
                    setPair(setup.pair);
                    setTimeframe(setup.timeframe);
                    setOpenId((current) => (current === setup.id ? null : setup.id));
                  }}
                />
              ))
          )}
        </div>
      </section>

      <section className="rounded-card border border-rule bg-panel">
        <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
          <Radar className="size-4 text-brass" />
          <h2 className="text-sm font-semibold text-paper">Screening latar</h2>
          <span className="text-xs text-muted">Tetap mencari. Yang terbaik dikunci; sisanya menunggu slot pair selesai.</span>
        </div>
        {desk.radar.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">Belum ada kandidat lain. M5 dan M15 tetap dibaca tiap tick.</p>
        ) : (
          <ul className="divide-y divide-rule">
            {desk.radar.map((item) => (
              <RadarRow key={`${item.pair}-${item.timeframe}-${item.direction}`} item={item} onOpen={() => { setPair(item.pair); setTimeframe(item.timeframe); }} />
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="min-w-0 overflow-hidden rounded-card border border-rule bg-panel lg:col-span-3">
          <div className="border-b border-rule px-4 py-3">
            <h2 className="text-sm font-semibold text-paper">Riwayat</h2>
            <p className="text-xs text-muted">Setiap setup yang selesai masuk sini untuk winrate.</p>
          </div>
          {desk.history.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">Belum ada setup selesai. Winrate muncul setelah TP atau SL pertama.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-xl text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="px-4 py-2 font-medium">Waktu</th>
                    <th className="px-2 py-2 font-medium">Pair</th>
                    <th className="px-2 py-2 font-medium">Arah</th>
                    <th className="px-2 py-2 font-medium">Conf</th>
                    <th className="px-2 py-2 font-medium">Hasil</th>
                    <th className="px-4 py-2 font-medium">R</th>
                  </tr>
                </thead>
                <tbody>
                  {desk.history.map((trade) => (
                    <tr key={`${trade.id}-${trade.closedAt}`} className="border-t border-rule">
                      <td className="px-4 py-2 font-mono text-xs text-muted">{formatWhen(trade.closedAt)}</td>
                      <td className="px-2 py-2 font-mono text-paper">
                        {trade.pair} {trade.timeframe}
                      </td>
                      <td className={trade.direction === "long" ? "px-2 py-2 text-long" : "px-2 py-2 text-short"}>
                        {trade.direction === "long" ? "LONG" : "SHORT"}
                      </td>
                      <td className="px-2 py-2 font-mono text-paper">{trade.confidence}</td>
                      <td className="px-2 py-2 text-paper">{outcomeText(trade)}</td>
                      <td className={"px-4 py-2 font-mono " + (trade.rMultiple > 0 ? "text-long" : trade.rMultiple < 0 ? "text-short" : "text-muted")}>
                        {trade.rMultiple > 0 ? "+" : ""}
                        {trade.rMultiple}R
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="rounded-card border border-rule bg-panel lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-rule px-4 py-3">
            <Activity className="size-4 text-brass" />
            <h2 className="text-sm font-semibold text-paper">Jejak</h2>
          </div>
          <ul className="flex flex-col gap-2 px-4 py-3">
            {desk.activity.length === 0 ? <li className="text-sm text-muted">Belum ada kunci atau penutupan.</li> : null}
            {desk.activity.map((note) => (
              <li key={note.id} className="text-sm text-paper">
                <span className="mr-2 font-mono text-xs text-muted">{formatWhen(note.at)}</span>
                {note.text}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-card border border-rule bg-panel px-3 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl text-paper">{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function LockedCard({ setup, open, onToggle }: { setup: LockedSetup; open: boolean; onToggle: () => void }) {
  const span = setup.direction === "long" ? setup.tp3 - setup.sl : setup.sl - setup.tp3;
  const pos = setup.direction === "long" ? setup.currentPrice - setup.sl : setup.sl - setup.currentPrice;
  const progress = span > 0 ? Math.min(1, Math.max(0, pos / span)) : 0;
  return (
    <button type="button" onClick={onToggle} className="rounded-card border border-rule bg-panel p-3 text-left">
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="font-mono text-sm text-paper">
            {setup.pair} {setup.timeframe}
          </span>
          <span className={"mt-1 block text-xs " + (setup.direction === "long" ? "text-long" : "text-short")}>
            {setup.direction === "long" ? "LONG" : "SHORT"} · {phaseLabel(setup)}
          </span>
        </span>
        <span className="text-right">
          <span className="block font-mono text-xl text-brass">{setup.confidence}</span>
          <span className="block text-xs text-muted">{setup.confluence}/7</span>
        </span>
      </span>
      <span className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-muted">
        <span>Entry {formatPrice(setup.pair, setup.entry)}</span>
        <span>SL {formatPrice(setup.pair, setup.stopPrice)}</span>
        <span>TP1 {formatPrice(setup.pair, setup.tp1)}</span>
        <span>TP2 {formatPrice(setup.pair, setup.tp2)}</span>
        <span>TP3 {formatPrice(setup.pair, setup.tp3)}</span>
        <span>Live {formatPrice(setup.pair, setup.currentPrice)}</span>
      </span>
      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-ink">
        <span className="block h-full bg-brass" style={{ width: `${progress * 100}%` }} />
      </span>
      {open ? <span className="mt-3 block whitespace-pre-wrap text-xs text-muted">{setup.rationale}</span> : null}
    </button>
  );
}

function RadarRow({ item, onOpen }: { item: RadarItem; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="font-mono text-sm text-paper">
            {item.pair} {item.timeframe}
          </span>
          <span className={"ml-2 text-xs " + (item.direction === "long" ? "text-long" : item.direction === "short" ? "text-short" : "text-muted")}>
            {item.direction === "long" ? "LONG" : item.direction === "short" ? "SHORT" : "—"}
            {item.confluence ? ` · ${item.confluence}/7` : ""}
          </span>
          <span className="mt-1 block text-xs text-muted">{item.note}</span>
        </span>
        <span className="font-mono text-lg text-brass">{item.confidence}</span>
      </button>
    </li>
  );
}

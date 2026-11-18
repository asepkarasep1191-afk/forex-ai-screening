import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { c as spotFits, r as applyExtreme, s as shiftToSpot, t as PAIRS } from "./live-price-B2Is9Zkr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/quotes-D7_WSGFW.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var CANDLE_TTL_MS = 2e4;
var BOOK_TTL_MS = 2500;
var SPOT_PATH = {
	XAUUSD: "XAU/USD",
	EURUSD: "EUR/USD",
	GBPUSD: "GBP/USD",
	USDJPY: "USD/JPY"
};
var rawCache = /* @__PURE__ */ new Map();
var extremes = /* @__PURE__ */ new Map();
var bookCache = null;
function rememberExtreme(pair, price, time) {
	const bucket = Math.floor(time / 3e5) * 3e5;
	const prev = extremes.get(pair);
	if (!prev || prev.bucket !== bucket) {
		const next = {
			bucket,
			high: price,
			low: price
		};
		extremes.set(pair, next);
		return next;
	}
	prev.high = Math.max(prev.high, price);
	prev.low = Math.min(prev.low, price);
	return prev;
}
async function fetchRaw(id, yahoo) {
	const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=5m&range=5d&includePrePost=true`;
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": "Mozilla/5.0"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const body = await response.json();
	const result = body.chart?.result?.[0];
	if (!result) throw new Error(body.chart?.error?.description || "tidak ada data");
	const times = result.timestamp ?? [];
	const quote = result.indicators?.quote?.[0];
	if (!quote) throw new Error("quote kosong");
	const candles = [];
	for (let i = 0; i < times.length; i++) {
		const open = quote.open?.[i];
		const high = quote.high?.[i];
		const low = quote.low?.[i];
		const close = quote.close?.[i];
		if (open == null || high == null || low == null || close == null) continue;
		candles.push({
			time: times[i] * 1e3,
			open,
			high,
			low,
			close,
			volume: quote.volume?.[i] ?? 0
		});
	}
	if (candles.length < 40) throw new Error("candle kurang");
	const trimmed = candles.slice(-240);
	const price = result.meta?.regularMarketPrice ?? trimmed[trimmed.length - 1].close;
	const time = (result.meta?.regularMarketTime ?? times[times.length - 1]) * 1e3;
	return {
		at: Date.now(),
		candles: trimmed,
		previousClose: result.meta?.previousClose ?? result.meta?.chartPreviousClose ?? null,
		yahooPrice: price,
		yahooTime: time
	};
}
async function ensureRaw(id, yahoo, now) {
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
function spotFromSwiss(body) {
	if (!Array.isArray(body)) return null;
	let best = null;
	for (const row of body) {
		const profiles = row.spreadProfilePrices;
		if (!Array.isArray(profiles)) continue;
		const picked = profiles.find((profile) => profile.spreadProfile === "elite") ?? profiles.find((profile) => profile.spreadProfile === "prime") ?? profiles[0];
		const bid = Number(picked?.bid);
		const ask = Number(picked?.ask);
		const ts = Number(row.ts);
		if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) continue;
		const time = ts > 0xe8d4a51000 ? ts : ts > 1e9 ? ts * 1e3 : Date.now();
		const spread = ask - bid;
		const price = (bid + ask) / 2;
		if (!best || spread < best.spread) best = {
			price,
			time,
			spread
		};
	}
	return best ? {
		price: best.price,
		time: best.time
	} : null;
}
async function fetchSwiss(pair) {
	try {
		const response = await fetch(`https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${SPOT_PATH[pair]}`, {
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0"
			},
			signal: AbortSignal.timeout(4e3)
		});
		if (!response.ok) return null;
		return spotFromSwiss(await response.json());
	} catch {
		return null;
	}
}
async function fetchGoldFallback() {
	try {
		const response = await fetch("https://api.gold-api.com/price/XAU", {
			headers: {
				Accept: "application/json",
				"User-Agent": "Mozilla/5.0"
			},
			signal: AbortSignal.timeout(4e3)
		});
		if (!response.ok) return null;
		const body = await response.json();
		const price = Number(body.price);
		if (!Number.isFinite(price) || price <= 0) return null;
		const parsed = body.updatedAt ? Date.parse(body.updatedAt) : Date.now();
		return {
			price,
			time: Number.isFinite(parsed) ? parsed : Date.now()
		};
	} catch {
		return null;
	}
}
async function fetchSpots() {
	const entries = await Promise.all(PAIRS.map(async (spec) => [spec.id, await fetchSwiss(spec.id)]));
	const spots = /* @__PURE__ */ new Map();
	for (const [id, spot] of entries) if (spot) spots.set(id, spot);
	if (!spots.has("XAUUSD")) {
		const fallback = await fetchGoldFallback();
		if (fallback) spots.set("XAUUSD", fallback);
	}
	return spots;
}
function sourceFor(pair, usedSpot) {
	if (pair === "XAUUSD") return usedSpot ? "XAUUSD spot" : "COMEX tertunda";
	return usedSpot ? "Spot live" : "Yahoo FX";
}
async function fetchQuoteBook() {
	const now = Date.now();
	if (bookCache && now - bookCache.at < BOOK_TTL_MS) return bookCache.book;
	const [, spots] = await Promise.all([Promise.all(PAIRS.map((spec) => ensureRaw(spec.id, spec.yahoo, now))), fetchSpots()]);
	const pairs = PAIRS.map((spec) => {
		const raw = rawCache.get(spec.id);
		if (!raw || raw.candles.length < 40) return {
			pair: spec.id,
			price: 0,
			time: 0,
			previousClose: null,
			candles: [],
			source: spec.source,
			error: "harga belum masuk"
		};
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
			source: sourceFor(spec.id, usedSpot)
		};
	});
	const book = {
		asOf: now,
		ok: pairs.some((pair) => !pair.error && pair.candles.length >= 40 && pair.price > 0),
		pairs
	};
	if (book.ok) bookCache = {
		at: now,
		book
	};
	return book;
}
var getQuotes_createServerFn_handler = createServerRpc({
	id: "a673a8a1f09677888b675c53e4deb70640b01398a1394a80fe784a9f4f360b66",
	name: "getQuotes",
	filename: "src/lib/quotes.ts"
}, (opts) => getQuotes.__executeServer(opts));
var getQuotes = createServerFn({ method: "GET" }).handler(getQuotes_createServerFn_handler, async () => {
	return fetchQuoteBook();
});
//#endregion
export { getQuotes_createServerFn_handler };

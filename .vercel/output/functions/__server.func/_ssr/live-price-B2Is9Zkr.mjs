//#region node_modules/.nitro/vite/services/ssr/assets/live-price-B2Is9Zkr.js
var PAIRS = [
	{
		id: "XAUUSD",
		label: "Gold / US Dollar",
		digits: 2,
		pip: .1,
		yahoo: "GC=F",
		source: "XAUUSD spot"
	},
	{
		id: "USDJPY",
		label: "US Dollar / Yen",
		digits: 3,
		pip: .01,
		yahoo: "USDJPY=X",
		source: "Yahoo FX"
	},
	{
		id: "GBPUSD",
		label: "Pound / US Dollar",
		digits: 5,
		pip: 1e-4,
		yahoo: "GBPUSD=X",
		source: "Yahoo FX"
	},
	{
		id: "EURUSD",
		label: "Euro / US Dollar",
		digits: 5,
		pip: 1e-4,
		yahoo: "EURUSD=X",
		source: "Yahoo FX"
	}
];
var TIMEFRAMES = ["M5", "M15"];
function pairSpec(id) {
	const found = PAIRS.find((pair) => pair.id === id);
	if (!found) throw new Error(`Unknown pair ${id}`);
	return found;
}
function formatPrice(id, value) {
	if (!Number.isFinite(value)) return "—";
	return value.toFixed(pairSpec(id).digits);
}
function roundTo(value, digits) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}
var BUCKET_MS = 3e5;
function spotFits(pair, lastClose, spot) {
	if (!Number.isFinite(lastClose) || !Number.isFinite(spot) || lastClose <= 0 || spot <= 0) return false;
	const gap = Math.abs(spot - lastClose);
	if (pair === "XAUUSD") return gap <= lastClose * .02;
	if (pair === "USDJPY") return gap <= .5;
	return gap <= .005;
}
function shiftToSpot(candles, spot, previousClose) {
	if (!candles.length || !Number.isFinite(spot)) return {
		candles: candles.map((candle) => ({ ...candle })),
		previousClose
	};
	const basis = spot - candles[candles.length - 1].close;
	const shifted = candles.map((candle) => ({
		time: candle.time,
		open: candle.open + basis,
		high: candle.high + basis,
		low: candle.low + basis,
		close: candle.close + basis,
		volume: candle.volume
	}));
	const tail = shifted[shifted.length - 1];
	tail.close = spot;
	tail.high = Math.max(tail.high, spot);
	tail.low = Math.min(tail.low, spot);
	return {
		candles: shifted,
		previousClose: previousClose == null || !Number.isFinite(previousClose) ? null : previousClose + basis
	};
}
function applyExtreme(candles, price, time, extreme, bucketMs = BUCKET_MS) {
	if (!candles.length || !Number.isFinite(price) || !Number.isFinite(time) || time <= 0) return candles.map((candle) => ({ ...candle }));
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
			low: Math.min(last.low, lo)
		};
		return next.slice(-240);
	}
	if (bucket > lastBucket) next.push({
		time: bucket,
		open: last.close,
		high: Math.max(last.close, hi),
		low: Math.min(last.close, lo),
		close: price,
		volume: 0
	});
	return next.slice(-240);
}
//#endregion
export { pairSpec as a, spotFits as c, formatPrice as i, TIMEFRAMES as n, roundTo as o, applyExtreme as r, shiftToSpot as s, PAIRS as t };

import { i as __toESM } from "../_runtime.mjs";
import { b as require_jsx_runtime, q as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as pairSpec, i as formatPrice, n as TIMEFRAMES, o as roundTo, r as applyExtreme, t as PAIRS } from "./live-price-B2Is9Zkr.mjs";
import { a as Pause, i as Play, n as Shield, o as Lock, r as Radar, s as Activity } from "../_libs/lucide-react.mjs";
import { n as Route, r as getQuotes } from "./router-Da6zYZx4.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Dn6Ss8rS.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CandleChart({ candles, pair, levels = [] }) {
	const view = candles.slice(-72);
	if (view.length < 2) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "px-4 py-16 text-center text-sm text-muted",
		children: "Candle realtime belum cukup."
	});
	const prices = [...view.flatMap((candle) => [candle.high, candle.low]), ...levels.map((level) => level.price)];
	const hi = Math.max(...prices);
	const span = hi - Math.min(...prices) || Math.abs(hi) * .001 || 1;
	const y = (price) => (hi - price) / span * 100;
	const width = 100 / view.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-64 w-full",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-x-0 top-0 border-t border-rule/80" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-x-0 top-1/2 border-t border-rule/80" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-x-0 bottom-0 border-t border-rule/80" }),
			levels.map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute inset-x-0",
				style: { top: `${y(level.price)}%` },
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: level.tone === "sl" ? "border-t border-short" : level.tone === "tp" ? "border-t border-long" : level.tone === "live" ? "border-t border-paper" : "border-t border-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "absolute right-0 -translate-y-1/2 px-1 font-mono text-xs " + (level.tone === "sl" ? "text-short" : level.tone === "tp" ? "text-long" : level.tone === "live" ? "text-paper" : "text-brass"),
					children: [
						level.label,
						" ",
						formatPrice(pair, level.price)
					]
				})]
			}, `${level.label}-${level.price}`)),
			view.map((candle, index) => {
				const up = candle.close >= candle.open;
				const top = y(Math.max(candle.open, candle.close));
				const bottom = y(Math.min(candle.open, candle.close));
				const body = Math.max(bottom - top, .6);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-y-0",
					style: {
						left: `${index * width}%`,
						width: `${width}%`
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute left-1/2 w-px -translate-x-1/2 " + (up ? "bg-long" : "bg-short"),
						style: {
							top: `${y(candle.high)}%`,
							height: `${Math.max(y(candle.low) - y(candle.high), .4)}%`
						}
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute " + (up ? "bg-long" : "bg-short"),
						style: {
							top: `${top}%`,
							height: `${body}%`,
							left: "22%",
							right: "22%"
						}
					})]
				}, candle.time);
			})
		]
	});
}
var METHOD_COUNT = 7;
var MIN_CONFLUENCE = 3;
function resample(candles, minutes) {
	if (minutes <= 5) return candles;
	const bucketMs = minutes * 60 * 1e3;
	const groups = /* @__PURE__ */ new Map();
	for (const candle of candles) {
		const time = Math.floor(candle.time / bucketMs) * bucketMs;
		const prev = groups.get(time);
		if (!prev) {
			groups.set(time, {
				...candle,
				time
			});
			continue;
		}
		prev.high = Math.max(prev.high, candle.high);
		prev.low = Math.min(prev.low, candle.low);
		prev.close = candle.close;
		prev.volume += candle.volume;
	}
	return [...groups.values()].sort((a, b) => a.time - b.time);
}
function ema(values, period) {
	const k = 2 / (period + 1);
	const out = [];
	let prev = values[0] ?? 0;
	out.push(prev);
	for (let i = 1; i < values.length; i++) {
		prev = values[i] * k + prev * (1 - k);
		out.push(prev);
	}
	return out;
}
function vwapOf(candles, lookback = 50) {
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
	return {
		value,
		upperBand: value + deviation,
		lowerBand: value - deviation,
		deviation
	};
}
function swingLevels(candles, lookback = 60) {
	const slice = candles.slice(-lookback);
	const highs = [];
	const lows = [];
	for (let i = 2; i < slice.length - 2; i++) {
		const candle = slice[i];
		if (candle.high > slice[i - 1].high && candle.high > slice[i - 2].high && candle.high > slice[i + 1].high && candle.high > slice[i + 2].high) highs.push(candle.high);
		if (candle.low < slice[i - 1].low && candle.low < slice[i - 2].low && candle.low < slice[i + 1].low && candle.low < slice[i + 2].low) lows.push(candle.low);
	}
	const cluster = (slice[0].high - slice[0].low) * 1.5;
	const levels = [];
	const absorb = (price, type) => {
		const found = levels.find((level) => level.type === type && Math.abs(level.price - price) < cluster);
		if (found) {
			found.price = (found.price * found.touches + price) / (found.touches + 1);
			found.touches += 1;
			found.strength = Math.min(found.touches * .3, 1);
		} else levels.push({
			price,
			strength: .3,
			touches: 1,
			type
		});
	};
	highs.forEach((price) => absorb(price, "resistance"));
	lows.forEach((price) => absorb(price, "support"));
	return levels.sort((a, b) => b.strength - a.strength);
}
function supplyDemand(candles, lookback = 50) {
	const slice = candles.slice(-lookback);
	const zones = [];
	for (let i = 3; i < slice.length - 1; i++) {
		const candle = slice[i];
		const prev = slice[i - 1];
		const next = slice[i + 1];
		const body = Math.abs(candle.close - candle.open);
		const range = candle.high - candle.low;
		const prevBody = Math.abs(prev.close - prev.open);
		if (range <= 0) continue;
		if (candle.close > candle.open && body > range * .6 && body > prevBody * 1.8 && next.close > candle.close) {
			const low = Math.min(candle.open, prev.low);
			const high = Math.max(candle.close, candle.open);
			if (!zones.some((zone) => zone.type === "demand" && Math.abs(zone.low - low) < range * 2)) zones.push({
				low,
				high,
				strength: .6,
				type: "demand",
				label: "Demand zone"
			});
		}
		if (candle.close < candle.open && body > range * .6 && body > prevBody * 1.8 && next.close < candle.close) {
			const high = Math.max(candle.open, prev.high);
			const low = Math.min(candle.close, candle.open);
			if (!zones.some((zone) => zone.type === "supply" && Math.abs(zone.high - high) < range * 2)) zones.push({
				low,
				high,
				strength: .6,
				type: "supply",
				label: "Supply zone"
			});
		}
	}
	return zones;
}
function bankZones(candles, vwap, lookback = 40) {
	const slice = candles.slice(-lookback);
	const zones = [];
	const hasVolume = slice.some((candle) => candle.volume > 0);
	let i = 0;
	while (i < slice.length) {
		const candle = slice[i];
		const range = candle.high - candle.low;
		const window = slice.slice(Math.max(0, i - 5), i);
		const avg = window.length > 0 ? window.reduce((sum, bar) => sum + (bar.high - bar.low), 0) / window.length : range;
		const volumeOk = hasVolume ? candle.volume > 3e3 : true;
		if (avg > 0 && range < avg * .6 && volumeOk) {
			let end = i + 1;
			while (end < slice.length && slice[end].high - slice[end].low < avg * .7) end += 1;
			if (end - i >= 3) {
				const block = slice.slice(i, end);
				const low = Math.min(...block.map((bar) => bar.low));
				const high = Math.max(...block.map((bar) => bar.high));
				const mid = (low + high) / 2;
				if (mid <= vwap.lowerBand + vwap.deviation * .3) zones.push({
					low,
					high,
					strength: .7,
					type: "bank_buy",
					label: "Institutional Buy Zone"
				});
				else if (mid >= vwap.upperBand - vwap.deviation * .3) zones.push({
					low,
					high,
					strength: .7,
					type: "bank_sell",
					label: "Institutional Sell Zone"
				});
				i = end;
				continue;
			}
		}
		i += 1;
	}
	return zones;
}
function liquidityPools(candles, levels, lookback = 40) {
	const slice = candles.slice(-lookback);
	const pools = [];
	const highs = slice.map((candle, idx) => ({
		price: candle.high,
		idx
	})).filter(({ idx }) => idx >= 2 && idx <= slice.length - 3 && slice[idx].high >= slice[idx - 1].high && slice[idx].high >= slice[idx + 1].high);
	const lows = slice.map((candle, idx) => ({
		price: candle.low,
		idx
	})).filter(({ idx }) => idx >= 2 && idx <= slice.length - 3 && slice[idx].low <= slice[idx - 1].low && slice[idx].low <= slice[idx + 1].low);
	const tolerance = (slice[0].high - slice[0].low) * .5;
	const cluster = (points, type, noun) => {
		const used = /* @__PURE__ */ new Set();
		for (let i = 0; i < points.length; i++) {
			if (used.has(i)) continue;
			const group = [points[i]];
			for (let j = i + 1; j < points.length; j++) if (Math.abs(points[j].price - points[i].price) < tolerance) {
				group.push(points[j]);
				used.add(j);
			}
			if (group.length >= 2) {
				const price = group.reduce((sum, item) => sum + item.price, 0) / group.length;
				pools.push({
					price,
					type,
					label: `${noun} (${group.length} equal ${type === "buyside" ? "highs" : "lows"})`,
					strength: Math.min(group.length * .25, 1)
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
			strength: level.strength * .8
		});
	}
	return pools.sort((a, b) => b.strength - a.strength);
}
function priceAction(candles, levels, pools) {
	const slice = candles.slice(-10);
	const signals = [];
	const last = slice[slice.length - 1];
	const body = Math.abs(last.close - last.open);
	const upper = last.high - Math.max(last.close, last.open);
	const lower = Math.min(last.close, last.open) - last.low;
	const range = last.high - last.low;
	if (range > 0) {
		if (lower > range * .6 && body < range * .35) signals.push({
			type: "Bullish Pin Bar",
			direction: "long",
			strength: .7,
			description: "Long lower wick rejection — buyers stepped in"
		});
		if (upper > range * .6 && body < range * .35) signals.push({
			type: "Bearish Pin Bar",
			direction: "short",
			strength: .7,
			description: "Long upper wick rejection — sellers stepped in"
		});
	}
	if (slice.length >= 2) {
		const prev = slice[slice.length - 2];
		if (prev.close < prev.open && last.close > last.open && last.close > prev.open && last.open < prev.close) signals.push({
			type: "Bullish Engulfing",
			direction: "long",
			strength: .75,
			description: "Bullish engulfing — buyers overwhelmed sellers"
		});
		if (prev.close > prev.open && last.close < last.open && last.close < prev.open && last.open > prev.close) signals.push({
			type: "Bearish Engulfing",
			direction: "short",
			strength: .75,
			description: "Bearish engulfing — sellers overwhelmed buyers"
		});
	}
	if (slice.length >= 3) {
		const inside = slice[slice.length - 2];
		const mother = slice[slice.length - 3];
		if (inside.high < mother.high && inside.low > mother.low) {
			if (last.close > mother.high) signals.push({
				type: "Inside Bar Breakout (Bullish)",
				direction: "long",
				strength: .6,
				description: "Price broke above inside bar range"
			});
			if (last.close < mother.low) signals.push({
				type: "Inside Bar Breakout (Bearish)",
				direction: "short",
				strength: .6,
				description: "Price broke below inside bar range"
			});
		}
	}
	for (const pool of pools.slice(0, 3)) {
		if (!slice.some((candle) => pool.type === "buyside" ? candle.high > pool.price && candle.close < pool.price : candle.low < pool.price && candle.close > pool.price)) continue;
		signals.push({
			type: `Liquidity Sweep (${pool.type})`,
			direction: pool.type === "buyside" ? "short" : "long",
			strength: pool.strength * .9,
			description: `${pool.label} swept then reversed — smart money entry`
		});
	}
	for (const level of levels.slice(0, 3)) {
		if (Math.abs(last.close - level.price) >= range * 2) continue;
		if (level.type === "resistance" && last.close < last.open) signals.push({
			type: "Rejection at Resistance",
			direction: "short",
			strength: level.strength * .8,
			description: `Price rejected at strong resistance (${level.touches} touches)`
		});
		if (level.type === "support" && last.close > last.open) signals.push({
			type: "Bounce off Support",
			direction: "long",
			strength: level.strength * .8,
			description: `Price bounced off strong support (${level.touches} touches)`
		});
	}
	return signals;
}
function trendOf(candles) {
	const slice = candles.slice(-30);
	if (slice.length < 10) return {
		trend: "ranging",
		trendStrength: 0
	};
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
	if (norm > 1e-4) bull += 1;
	else if (norm < -1e-4) bear += 1;
	if (fast[fast.length - 1] > slow[slow.length - 1]) bull += 1;
	else if (fast[fast.length - 1] < slow[slow.length - 1]) bear += 1;
	const recent = slice.slice(-5);
	if (recent.every((candle, index, arr) => index === 0 || candle.high >= arr[index - 1].high * .999)) bull += 1;
	if (recent.every((candle, index, arr) => index === 0 || candle.low <= arr[index - 1].low * 1.001)) bear += 1;
	const strength = Math.min(Math.abs(norm) * 1e4, 1);
	if (bull >= 2 && bull > bear) return {
		trend: "bullish",
		trendStrength: strength
	};
	if (bear >= 2 && bear > bull) return {
		trend: "bearish",
		trendStrength: strength
	};
	return {
		trend: "ranging",
		trendStrength: 0
	};
}
function px(value) {
	return value.toFixed(5).replace(/\.?0+$/, "");
}
function methodsOf(market) {
	const { currentPrice, vwap, levels, zones, liquidity, priceAction: signals, trend, trendStrength } = market;
	const last = market.candles[market.candles.length - 1];
	const range = last.high - last.low;
	const vwapDelta = currentPrice - vwap.value;
	const vwapCheck = vwapDelta < -vwap.deviation * .3 ? {
		name: "VWAP",
		confirmed: true,
		direction: "long",
		detail: `Harga di bawah VWAP (${px(vwap.value)}) — bias long mean reversion`
	} : vwapDelta > vwap.deviation * .3 ? {
		name: "VWAP",
		confirmed: true,
		direction: "short",
		detail: `Harga di atas VWAP (${px(vwap.value)}) — bias short mean reversion`
	} : {
		name: "VWAP",
		confirmed: false,
		direction: "neutral",
		detail: "Harga dekat VWAP — tidak ada bias"
	};
	const trendCheck = trend === "bullish" && trendStrength > .05 ? {
		name: "Trend",
		confirmed: true,
		direction: "long",
		detail: `Tren bullish (kekuatan ${trendStrength.toFixed(2)})`
	} : trend === "bearish" && trendStrength > .05 ? {
		name: "Trend",
		confirmed: true,
		direction: "short",
		detail: `Tren bearish (kekuatan ${trendStrength.toFixed(2)})`
	} : {
		name: "Trend",
		confirmed: false,
		direction: "neutral",
		detail: "Market ranging — tidak ada bias tren"
	};
	let srCheck = {
		name: "Support/Resistance",
		confirmed: false,
		direction: "neutral",
		detail: "Harga tidak dekat level S/R"
	};
	for (const level of levels.slice(0, 5)) if (Math.abs(currentPrice - level.price) < range * 3) {
		srCheck = level.type === "support" ? {
			name: "Support/Resistance",
			confirmed: true,
			direction: "long",
			detail: `Harga di support (${level.touches} sentuh, kekuatan ${level.strength.toFixed(2)})`
		} : {
			name: "Support/Resistance",
			confirmed: true,
			direction: "short",
			detail: `Harga di resistance (${level.touches} sentuh, kekuatan ${level.strength.toFixed(2)})`
		};
		break;
	}
	let zoneCheck = {
		name: "Supply/Demand",
		confirmed: false,
		direction: "neutral",
		detail: "Harga tidak di zona supply/demand"
	};
	for (const zone of zones) {
		if (currentPrice < zone.low - range * 2 || currentPrice > zone.high + range * 2) continue;
		if (zone.type === "demand" || zone.type === "bank_buy") {
			zoneCheck = {
				name: "Supply/Demand",
				confirmed: true,
				direction: "long",
				detail: `Harga di ${zone.label} (${px(zone.low)}–${px(zone.high)})`
			};
			break;
		}
		if (zone.type === "supply" || zone.type === "bank_sell") {
			zoneCheck = {
				name: "Supply/Demand",
				confirmed: true,
				direction: "short",
				detail: `Harga di ${zone.label} (${px(zone.low)}–${px(zone.high)})`
			};
			break;
		}
	}
	let bankCheck = {
		name: "Bank/Institutional Zone",
		confirmed: false,
		direction: "neutral",
		detail: "Harga tidak di zona institusi"
	};
	for (const zone of zones.filter((item) => item.type === "bank_buy" || item.type === "bank_sell")) {
		if (currentPrice < zone.low - range * 2 || currentPrice > zone.high + range * 2) continue;
		bankCheck = zone.type === "bank_buy" ? {
			name: "Bank/Institutional Zone",
			confirmed: true,
			direction: "long",
			detail: `${zone.label} — akumulasi dekat lower band VWAP`
		} : {
			name: "Bank/Institutional Zone",
			confirmed: true,
			direction: "short",
			detail: `${zone.label} — distribusi dekat upper band VWAP`
		};
		break;
	}
	if (!bankCheck.confirmed) {
		if (currentPrice <= vwap.lowerBand + vwap.deviation * .2) bankCheck = {
			name: "Bank/Institutional Zone",
			confirmed: true,
			direction: "long",
			detail: "Harga dekat lower band VWAP — area beli institusi"
		};
		else if (currentPrice >= vwap.upperBand - vwap.deviation * .2) bankCheck = {
			name: "Bank/Institutional Zone",
			confirmed: true,
			direction: "short",
			detail: "Harga dekat upper band VWAP — area jual institusi"
		};
	}
	const sweep = signals.find((signal) => signal.type.includes("Liquidity Sweep"));
	let liqCheck = {
		name: "Liquidity",
		confirmed: false,
		direction: "neutral",
		detail: "Tidak ada kolam likuiditas di dekat harga"
	};
	if (sweep) liqCheck = {
		name: "Liquidity",
		confirmed: true,
		direction: sweep.direction,
		detail: sweep.description
	};
	else for (const pool of liquidity.slice(0, 3)) {
		if (Math.abs(currentPrice - pool.price) >= range * 3) continue;
		liqCheck = pool.type === "sellside" ? {
			name: "Liquidity",
			confirmed: true,
			direction: "long",
			detail: `${pool.label} di dekat harga — potensi sapu low lalu naik`
		} : {
			name: "Liquidity",
			confirmed: true,
			direction: "short",
			detail: `${pool.label} di dekat harga — potensi sapu high lalu turun`
		};
		break;
	}
	const strong = signals.filter((signal) => signal.strength >= .6).sort((a, b) => b.strength - a.strength);
	const paCheck = strong[0] ? {
		name: "Price Action",
		confirmed: true,
		direction: strong[0].direction,
		detail: `${strong[0].type}: ${strong[0].description}`
	} : {
		name: "Price Action",
		confirmed: false,
		direction: "neutral",
		detail: "Tidak ada sinyal price action yang kuat"
	};
	return [
		vwapCheck,
		trendCheck,
		srCheck,
		zoneCheck,
		bankCheck,
		liqCheck,
		paCheck
	];
}
function confidenceScore(direction, methods, trend, trendStrength) {
	const aligned = methods.filter((method) => method.confirmed && method.direction === direction);
	let score = aligned.length / METHOD_COUNT * 72;
	if (aligned.some((method) => method.name === "Price Action")) score += 8;
	if (aligned.some((method) => method.name === "Liquidity")) score += 6;
	if (direction === "long" && trend === "bullish" || direction === "short" && trend === "bearish") score += 6 + Math.min(8, trendStrength * 20);
	return Math.max(32, Math.min(97, Math.round(score)));
}
function placeRisk(direction, price, structuralEntry, structuralSl, avgRange, swingLow, swingHigh) {
	const minRisk = Math.max(avgRange * .8, Math.abs(price) * 5e-5);
	let entry = structuralEntry;
	let sl = structuralSl;
	const risk = Math.abs(entry - sl);
	const onCorrectSide = direction === "long" ? sl < Math.min(price, entry) : sl > Math.max(price, entry);
	const near = Math.abs(price - entry) <= Math.max(risk, avgRange) * 1.25;
	const stillOpen = direction === "long" ? price > sl && price < entry + Math.max(risk, minRisk) : price < sl && price > entry - Math.max(risk, minRisk);
	if (!onCorrectSide || !near || !stillOpen || !(risk > 0)) {
		entry = price;
		if (direction === "long") {
			const swingStop = swingLow - avgRange * .25;
			sl = swingStop < price ? swingStop : price - minRisk;
			if (price - sl < minRisk) sl = price - minRisk;
		} else {
			const swingStop = swingHigh + avgRange * .25;
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
	return {
		entry,
		sl
	};
}
function buildPlan(market, direction, votes) {
	const spec = pairSpec(market.pair);
	const price = market.currentPrice;
	const recent = market.candles.slice(-10);
	const avgRange = recent.reduce((sum, candle) => sum + (candle.high - candle.low), 0) / Math.max(recent.length, 1);
	const swingLow = Math.min(...recent.map((candle) => candle.low));
	const swingHigh = Math.max(...recent.map((candle) => candle.high));
	let structuralEntry = price;
	let structuralSl = direction === "long" ? swingLow - avgRange * .5 : swingHigh + avgRange * .5;
	if (direction === "long") {
		const support = market.levels.filter((level) => level.type === "support" && level.price <= price).sort((a, b) => b.price - a.price)[0];
		const zone = market.zones.filter((item) => item.type === "demand" || item.type === "bank_buy").sort((a, b) => Math.abs((a.high + a.low) / 2 - price) - Math.abs((b.high + b.low) / 2 - price))[0];
		structuralEntry = zone ? (zone.high + zone.low) / 2 : support ? support.price : price;
		structuralSl = zone ? zone.low - avgRange * .5 : support ? support.price - avgRange * .5 : swingLow - avgRange * .5;
		if (structuralSl >= structuralEntry) structuralSl = structuralEntry - avgRange * 1.5;
	} else {
		const resistance = market.levels.filter((level) => level.type === "resistance" && level.price >= price).sort((a, b) => a.price - b.price)[0];
		const zone = market.zones.filter((item) => item.type === "supply" || item.type === "bank_sell").sort((a, b) => Math.abs((a.high + a.low) / 2 - price) - Math.abs((b.high + b.low) / 2 - price))[0];
		structuralEntry = zone ? (zone.high + zone.low) / 2 : resistance ? resistance.price : price;
		structuralSl = zone ? zone.high + avgRange * .5 : resistance ? resistance.price + avgRange * .5 : swingHigh + avgRange * .5;
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
		entryZoneLow: roundTo(entry - avgRange * .3, digits),
		entryZoneHigh: roundTo(entry + avgRange * .3, digits),
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
		rationale: `${side} ${market.pair} ${market.timeframe} dengan konfluensi ${votes.length} metode (${names}).\n\n${lines}\n\nEntry ${formatPrice(market.pair, entry)}\nSL ${formatPrice(market.pair, sl)}\nTP1 ${formatPrice(market.pair, tp1)} (1R)\nTP2 ${formatPrice(market.pair, tp2)} (2R)\nTP3 ${formatPrice(market.pair, tp3)} (3R)\n\nRencana: masuk di zona, SL di luar struktur. TP1 menggeser SL ke entry. TP2 menggeser SL ke TP1. Selesai di TP3 atau SL.`
	};
}
function analyzeMarket(pair, timeframe, candles) {
	if (candles.length < 40) return null;
	const used = candles.slice(-160);
	const vwap = vwapOf(used);
	const levels = swingLevels(used);
	const zones = [...supplyDemand(used), ...bankZones(used, vwap)];
	const liquidity = liquidityPools(used, levels);
	const signals = priceAction(used, levels, liquidity);
	const { trend, trendStrength } = trendOf(used);
	const market = {
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
		methods: []
	};
	market.methods = methodsOf(market);
	return market;
}
function planFromMarket(market) {
	const longs = market.methods.filter((method) => method.confirmed && method.direction === "long");
	const shorts = market.methods.filter((method) => method.confirmed && method.direction === "short");
	if (longs.length === shorts.length || Math.max(longs.length, shorts.length) < MIN_CONFLUENCE) return null;
	const direction = longs.length > shorts.length ? "long" : "short";
	return buildPlan(market, direction, direction === "long" ? longs : shorts);
}
function isActionable(plan, price) {
	if (plan.direction === "long") return price > plan.sl && price < plan.tp1;
	return price < plan.sl && price > plan.tp1;
}
function marketKey(pair, timeframe) {
	return `${pair}_${timeframe}`;
}
function initialPhase(plan, price) {
	if (plan.direction === "long") return price < plan.entry ? "pending" : "live";
	return price > plan.entry ? "pending" : "live";
}
function lockSetup(plan, price, barTime, now, seen) {
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
		trackLow: seen ? Math.min(seen.low, price) : price
	};
}
function closeTrade(setup, outcome, exitPrice, now) {
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
		result
	};
}
function outcomeLabel(outcome) {
	if (outcome === "sl") return "SL";
	if (outcome === "be") return "BE di entry";
	if (outcome === "tp1") return "tertahan di TP1";
	return "TP3";
}
function noteForClose(setup, closed) {
	const tone = closed.result === "win" ? "win" : closed.result === "loss" ? "loss" : "info";
	return {
		id: `${setup.id}-close-${closed.closedAt}`,
		at: closed.closedAt,
		tone,
		text: `${setup.pair} ${setup.timeframe} selesai · ${outcomeLabel(closed.outcome)} · ${closed.rMultiple}R · confidence ${setup.confidence}`
	};
}
function tickSetup(setup, bar, price, now) {
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
			if (invalidated || (long ? excursionHigh >= setup.tp1 : excursionLow <= setup.tp1)) return {
				setup: null,
				note: {
					id: `${setup.id}-void-${now}`,
					at: now,
					tone: "info",
					text: `${setup.pair} ${setup.timeframe} batal sebelum entry — slot dibuka lagi`
				}
			};
			return { setup: {
				...setup,
				currentPrice: price,
				trackBar,
				trackHigh,
				trackLow
			} };
		}
		phase = "live";
		filledAt = now;
		if (long ? excursionLow <= setup.sl : excursionHigh >= setup.sl) {
			const closed = closeTrade(setup, "sl", setup.sl, now);
			return {
				setup: null,
				closed,
				note: noteForClose(setup, closed)
			};
		}
	}
	if (long ? excursionLow <= stopPrice : excursionHigh >= stopPrice) {
		const outcome = phase === "live" ? "sl" : phase === "tp1" ? "be" : "tp1";
		const closed = closeTrade({
			...setup,
			phase
		}, outcome, stopPrice, now);
		return {
			setup: null,
			closed,
			note: noteForClose(setup, closed)
		};
	}
	if (long ? excursionHigh >= setup.tp3 : excursionLow <= setup.tp3) {
		const closed = closeTrade(setup, "tp3", setup.tp3, now);
		return {
			setup: null,
			closed,
			note: noteForClose(setup, closed)
		};
	}
	let note;
	if (phase !== "tp2" && (long ? excursionHigh >= setup.tp2 : excursionLow <= setup.tp2)) {
		phase = "tp2";
		stopPrice = setup.tp1;
		tp2HitAt = tp2HitAt ?? now;
		tp1HitAt = tp1HitAt ?? now;
		note = {
			id: `${setup.id}-tp2-${now}`,
			at: now,
			tone: "info",
			text: `${setup.pair} ${setup.timeframe} TP2 — SL dikunci di TP1`
		};
	} else if (phase === "live" && (long ? excursionHigh >= setup.tp1 : excursionLow <= setup.tp1)) {
		phase = "tp1";
		stopPrice = setup.entry;
		tp1HitAt = now;
		note = {
			id: `${setup.id}-tp1-${now}`,
			at: now,
			tone: "info",
			text: `${setup.pair} ${setup.timeframe} TP1 — SL dikunci di entry`
		};
	}
	return {
		setup: {
			...setup,
			phase,
			stopPrice,
			filledAt,
			tp1HitAt,
			tp2HitAt,
			currentPrice: price,
			trackBar,
			trackHigh,
			trackLow
		},
		note
	};
}
function quoteIsFresh(time, now) {
	return time > 0 && now - time <= 45e3 && time - now <= 15e3;
}
function selectLocks(running, plans, paused) {
	const busy = new Set(running.map((setup) => setup.pair));
	const grouped = /* @__PURE__ */ new Map();
	for (const plan of plans) {
		const list = grouped.get(plan.pair) ?? [];
		list.push(plan);
		grouped.set(plan.pair, list);
	}
	const lock = [];
	const hold = [];
	for (const [pair, list] of grouped) {
		const ranked = list.slice().sort((a, b) => b.confidence - a.confidence || b.confluence - a.confluence || (a.timeframe === "M15" ? -1 : 1));
		if (paused || busy.has(pair)) {
			const note = paused ? "Kunci dijeda — kandidat tetap dipantau" : "Slot pair terkunci sampai TP/SL — kandidat latar";
			for (const plan of ranked) hold.push({
				plan,
				note
			});
			continue;
		}
		lock.push(ranked[0]);
		for (const plan of ranked.slice(1)) hold.push({
			plan,
			note: `Di bawah setup terbaik ${pair} (${ranked[0].timeframe} · ${ranked[0].confidence})`
		});
	}
	return {
		lock,
		hold
	};
}
function watchLean(market) {
	const longs = market.methods.filter((method) => method.confirmed && method.direction === "long");
	const shorts = market.methods.filter((method) => method.confirmed && method.direction === "short");
	if (longs.length === shorts.length) return null;
	const direction = longs.length > shorts.length ? "long" : "short";
	const votes = direction === "long" ? longs : shorts;
	if (votes.length < 2 || votes.length >= MIN_CONFLUENCE) return null;
	return {
		pair: market.pair,
		timeframe: market.timeframe,
		direction,
		confidence: confidenceScore(direction, market.methods, market.trend, market.trendStrength),
		confluence: votes.length,
		status: "watch",
		note: `${votes.length}/7 metode searah — belum dikunci`
	};
}
function screenBook(quotes, running, options) {
	const markets = {};
	const closed = [];
	const notes = [];
	const next = running.map((setup) => ({ ...setup }));
	const actionable = [];
	const radar = [];
	for (const quote of quotes) {
		if (!quoteIsFresh(quote.time, options.now) || !Number.isFinite(quote.price) || quote.price <= 0) continue;
		for (const timeframe of ["M5", "M15"]) {
			const series = timeframe === "M5" ? quote.candles : resample(quote.candles, 15);
			if (series.length === 0) continue;
			const last = series[series.length - 1];
			const bar = {
				...last,
				close: quote.price,
				high: Math.max(last.high, quote.price),
				low: Math.min(last.low, quote.price)
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
			const priced = [...series.slice(0, -1), {
				...last,
				close: quote.price,
				high: Math.max(last.high, quote.price),
				low: Math.min(last.low, quote.price)
			}];
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
					note: "Harga sudah lewat zona — tidak dikunci"
				});
				continue;
			}
			actionable.push({
				plan,
				barTime: bar.time,
				high: bar.high,
				low: bar.low
			});
		}
	}
	const chosen = selectLocks(next, actionable.map((item) => item.plan), options.paused);
	const byKey = new Map(actionable.map((item) => [marketKey(item.plan.pair, item.plan.timeframe), item]));
	for (const plan of chosen.lock) {
		const ctx = byKey.get(marketKey(plan.pair, plan.timeframe));
		const live = quotes.find((quote) => quote.pair === plan.pair);
		if (!ctx || !live) continue;
		const locked = lockSetup(plan, live.price, ctx.barTime, options.now, {
			high: ctx.high,
			low: ctx.low
		});
		next.push(locked);
		notes.push({
			id: `${locked.id}-lock`,
			at: options.now,
			tone: "lock",
			text: `Terkunci ${locked.pair} ${locked.timeframe} ${locked.direction === "long" ? "LONG" : "SHORT"} · confidence ${locked.confidence} · ${locked.confluence}/7`
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
			note: item.note
		});
	}
	const rank = {
		queued: 0,
		late: 1,
		watch: 2
	};
	radar.sort((a, b) => rank[a.status] - rank[b.status] || b.confidence - a.confidence || b.confluence - a.confluence);
	return {
		running: next,
		radar,
		closed,
		notes,
		markets
	};
}
function summarize(history) {
	const wins = history.filter((trade) => trade.result === "win").length;
	const losses = history.filter((trade) => trade.result === "loss").length;
	const breakeven = history.filter((trade) => trade.result === "be").length;
	const decisive = wins + losses;
	return {
		wins,
		losses,
		breakeven,
		rate: decisive > 0 ? wins / decisive : null,
		avgR: history.length > 0 ? history.reduce((sum, trade) => sum + trade.rMultiple, 0) / history.length : null,
		closed: history.length
	};
}
var STORAGE_KEY = "meja-screening-v1";
var sessionExtremes = /* @__PURE__ */ new Map();
function withSession(pair, candles, price, time) {
	const bucket = Math.floor(time / 3e5) * 3e5;
	const prev = sessionExtremes.get(pair);
	const extreme = !prev || prev.bucket !== bucket ? {
		bucket,
		high: price,
		low: price
	} : {
		bucket,
		high: Math.max(prev.high, price),
		low: Math.min(prev.low, price)
	};
	sessionExtremes.set(pair, extreme);
	return applyExtreme(candles, price, time, extreme);
}
function readPersisted() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed.running) || !Array.isArray(parsed.history)) return null;
		return {
			running: parsed.running,
			history: parsed.history.slice(0, 80),
			paused: Boolean(parsed.paused)
		};
	} catch {
		return null;
	}
}
function writePersisted(state) {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
			running: state.running,
			history: state.history.slice(0, 80),
			paused: state.paused
		}));
	} catch {}
}
var useDesk = create((set, get) => ({
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
			paused: saved?.paused ?? false
		});
	},
	setPaused: (paused) => {
		set({ paused });
		const state = get();
		writePersisted({
			running: state.running,
			history: state.history,
			paused
		});
	},
	ingest: (book) => {
		const state = get();
		const screened = screenBook(book.pairs.filter((pair) => pair.candles.length >= 40 && Number.isFinite(pair.price) && pair.price > 0).map((pair) => {
			const time = pair.time || book.asOf;
			return {
				pair: pair.pair,
				candles: withSession(pair.pair, pair.candles, pair.price, time),
				price: pair.price,
				time
			};
		}), state.hydrated ? state.running : state.running, {
			paused: state.paused,
			now: book.asOf
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
			scans: state.scans + 1
		});
		if (state.hydrated) writePersisted({
			running: screened.running,
			history,
			paused: state.paused
		});
	}
}));
function quoteFor(book, pair) {
	return book?.pairs.find((item) => item.pair === pair) ?? null;
}
function marketFor(markets, pair, timeframe) {
	return markets[`${pair}_${timeframe}`] ?? null;
}
var POLL_MS = 5e3;
function phaseLabel(setup) {
	if (setup.phase === "pending") return "Menunggu entry";
	if (setup.phase === "tp1") return "TP1 · SL di entry";
	if (setup.phase === "tp2") return "TP2 · SL di TP1";
	return "Berjalan";
}
function outcomeText(trade) {
	if (trade.outcome === "sl") return "SL";
	if (trade.outcome === "be") return "BE";
	if (trade.outcome === "tp1") return "TP1";
	return "TP3";
}
function formatWhen(time) {
	return new Intl.DateTimeFormat("id-ID", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Asia/Jakarta"
	}).format(time);
}
function ageLabel(time, now) {
	const seconds = Math.max(0, Math.round((now - time) / 1e3));
	if (seconds < 90) return `${seconds} dtk`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 90) return `${minutes} mnt`;
	return `${Math.round(minutes / 60)} jam`;
}
function ScreeningDesk({ initial }) {
	const desk = useDesk();
	const [pair, setPair] = (0, import_react.useState)("XAUUSD");
	const [timeframe, setTimeframe] = (0, import_react.useState)("M15");
	const [openId, setOpenId] = (0, import_react.useState)(null);
	const [clock, setClock] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const store = useDesk.getState();
		store.hydrate();
		store.ingest(initial);
		setClock(Date.now());
		const clockId = setInterval(() => setClock(Date.now()), 1e3);
		let stopped = false;
		let timer = 0;
		const poll = async () => {
			try {
				const book = await getQuotes();
				if (!stopped) useDesk.getState().ingest(book);
			} catch {} finally {
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
	const fallbackMarket = (0, import_react.useMemo)(() => {
		if (!quote || quote.candles.length < 40 || quote.price <= 0) return null;
		const series = timeframe === "M15" ? resample(quote.candles, 15) : quote.candles;
		const last = series[series.length - 1];
		if (!last) return null;
		const priced = [...series.slice(0, -1), {
			...last,
			close: quote.price,
			high: Math.max(last.high, quote.price),
			low: Math.min(last.low, quote.price)
		}];
		return analyzeMarket(pair, timeframe, priced);
	}, [
		quote,
		pair,
		timeframe
	]);
	const market = storedMarket ?? fallbackMarket;
	const stats = summarize(desk.history);
	const selectedLocked = desk.running.find((setup) => setup.pair === pair && setup.timeframe === timeframe) ?? null;
	const rawCandles = quote?.candles ?? [];
	const chartCandles = market?.candles ?? (timeframe === "M15" ? resample(rawCandles, 15) : rawCandles);
	const livePrice = quote && quote.price > 0 ? quote.price : null;
	const change = quote && quote.previousClose && livePrice ? (livePrice - quote.previousClose) / quote.previousClose * 100 : null;
	const now = clock ?? book.asOf;
	const freshStamps = book.pairs.map((item) => item.time).filter((time) => time > 0);
	const oldestStamp = freshStamps.length > 0 ? Math.min(...freshStamps) : book.asOf;
	const levels = selectedLocked ? [
		{
			price: selectedLocked.entry,
			label: "Entry",
			tone: "entry"
		},
		{
			price: selectedLocked.stopPrice,
			label: "SL",
			tone: "sl"
		},
		{
			price: selectedLocked.tp1,
			label: "TP1",
			tone: "tp"
		},
		{
			price: selectedLocked.tp2,
			label: "TP2",
			tone: "tp"
		},
		{
			price: selectedLocked.tp3,
			label: "TP3",
			tone: "tp"
		}
	] : livePrice ? [{
		price: livePrice,
		label: "Live",
		tone: "live"
	}] : [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-mono text-xs tracking-widest text-brass",
						children: "NORTH DESK"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-semibold text-paper",
						children: "Meja Screening"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 max-w-xl text-sm text-muted",
						children: "XAUUSD, USDJPY, GBPUSD, EURUSD. Setup terbaik tiap pair dikunci beserta confidence-nya sampai kena TP atau SL. Scanner tetap mencari di belakang."
					})
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-mono text-sm text-paper",
							children: clock ? formatWhen(clock) : "WIB"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: book.ok ? `Harga spot · tertua ${ageLabel(oldestStamp, now)}` : "Harga belum masuk"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							const next = !useDesk.getState().paused;
							useDesk.getState().setPaused(next);
							const current = useDesk.getState().book;
							if (current) useDesk.getState().ingest(current);
						},
						className: "inline-flex min-h-11 items-center gap-2 rounded-card border border-rule bg-panel px-3 text-sm text-paper",
						children: [desk.paused ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-4 text-brass" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pause, { className: "size-4 text-brass" }), desk.paused ? "Lanjut kunci" : "Jeda kunci"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-2 gap-3 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Winrate",
						value: stats.rate == null ? "—" : `${Math.round(stats.rate * 100)}%`,
						hint: "Menang / (menang + kalah). BE di luar."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Selesai",
						value: `${stats.wins}M ${stats.losses}K`,
						hint: `${stats.breakeven} BE · ${stats.closed} tercatat`
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "R rata-rata",
						value: stats.avgR == null ? "—" : `${stats.avgR > 0 ? "+" : ""}${stats.avgR.toFixed(2)}R`,
						hint: "Termasuk BE dan SL"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Terkunci",
						value: String(desk.running.length),
						hint: desk.paused ? "Kunci baru dijeda" : `${desk.scans} sapuan live`
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
				className: "grid grid-cols-2 gap-2 lg:grid-cols-4",
				children: PAIRS.map((spec) => {
					const row = quoteFor(book, spec.id);
					const active = pair === spec.id;
					const px = row && row.price > 0 ? row.price : null;
					const delta = row?.previousClose && px ? (px - row.previousClose) / row.previousClose * 100 : null;
					const locked = desk.running.some((setup) => setup.pair === spec.id);
					const fresh = row ? quoteIsFresh(row.time, now) : false;
					const wr = summarize(desk.history.filter((trade) => trade.pair === spec.id));
					const wrText = wr.closed === 0 ? "WR —" : wr.rate == null ? `WR — · ${wr.closed}` : `WR ${Math.round(wr.rate * 100)}% · ${wr.closed}`;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setPair(spec.id),
						className: "min-h-11 rounded-card border px-3 py-2 text-left " + (active ? "border-brass bg-raised" : "border-rule bg-panel"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-sm text-paper",
									children: spec.id
								}), locked ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lock, { className: "size-4 text-brass" }) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-1 block font-mono text-lg " + ((delta ?? 0) >= 0 ? "text-long" : "text-short"),
								children: px == null ? "—" : formatPrice(spec.id, px)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-xs text-muted",
								children: row?.error ? row.error : `${delta == null ? row?.source ?? spec.source : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}% · ${row?.source ?? spec.source}`} · ${fresh ? "live" : "tertunda"}`
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-xs text-muted",
								children: wrText
							})
						]
					}, spec.id);
				})
			}),
			!book.ok ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-card border border-short/50 bg-panel px-4 py-3 text-sm text-short",
				children: "Harga realtime gagal dimuat. Screening tidak memakai data simulasi."
			}) : null,
			book.ok && book.pairs.some((item) => item.price > 0 && !quoteIsFresh(item.time, now)) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-card border border-brass/40 bg-panel px-4 py-3 text-sm text-brass",
				children: "Ada pair yang harganya tertunda. Setup pair itu tidak dikunci dan tidak digeser sampai tick-nya segar lagi."
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 rounded-card border border-rule bg-panel lg:col-span-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
								className: "font-mono text-sm text-paper",
								children: [
									pair,
									" · ",
									timeframe
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs text-muted",
								children: [
									livePrice == null ? "Menunggu tick" : formatPrice(pair, livePrice),
									change == null ? "" : ` · ${change >= 0 ? "+" : ""}${change.toFixed(2)}% hari ini`,
									market ? ` · tren ${market.trend}` : ""
								]
							})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex rounded-card border border-rule p-1",
								children: TIMEFRAMES.map((tf) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setTimeframe(tf),
									className: "min-h-11 rounded-md px-3 font-mono text-sm " + (timeframe === tf ? "bg-raised text-paper" : "text-muted"),
									children: tf
								}, tf))
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CandleChart, {
							candles: chartCandles,
							pair,
							levels
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
							className: "grid gap-2 border-t border-rule p-3 sm:grid-cols-2",
							children: [(market?.methods ?? []).map((method) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "rounded-md border border-rule bg-ink px-3 py-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-sm text-paper",
										children: method.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-mono text-xs " + (method.confirmed ? method.direction === "long" ? "text-long" : "text-short" : "text-muted"),
										children: method.confirmed ? method.direction.toUpperCase() : "—"
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block text-xs text-muted",
									children: method.detail
								})]
							}, method.name)), !market ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "text-sm text-muted",
								children: "Metode dihitung dari candle live begitu sapuan pertama selesai."
							}) : null]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-col gap-3 lg:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-paper",
							children: "Setup terkunci"
						})]
					}), desk.running.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "rounded-card border border-dashed border-rule px-4 py-6 text-sm text-muted",
						children: "Belum ada yang lolos. Scanner tetap membaca keempat pair di M5 dan M15."
					}) : desk.running.slice().sort((a, b) => b.confidence - a.confidence).map((setup) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LockedCard, {
						setup,
						open: openId === setup.id,
						onToggle: () => {
							setPair(setup.pair);
							setTimeframe(setup.timeframe);
							setOpenId((current) => current === setup.id ? null : setup.id);
						}
					}, setup.id))]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-card border border-rule bg-panel",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-b border-rule px-4 py-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radar, { className: "size-4 text-brass" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-paper",
							children: "Screening latar"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-xs text-muted",
							children: "Tetap mencari. Yang terbaik dikunci; sisanya menunggu slot pair selesai."
						})
					]
				}), desk.radar.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-5 text-sm text-muted",
					children: "Belum ada kandidat lain. M5 dan M15 tetap dibaca tiap tick."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "divide-y divide-rule",
					children: desk.radar.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadarRow, {
						item,
						onOpen: () => {
							setPair(item.pair);
							setTimeframe(item.timeframe);
						}
					}, `${item.pair}-${item.timeframe}-${item.direction}`))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid gap-4 lg:grid-cols-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 overflow-hidden rounded-card border border-rule bg-panel lg:col-span-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-b border-rule px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-paper",
							children: "Riwayat"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Setiap setup yang selesai masuk sini untuk winrate."
						})]
					}), desk.history.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 py-5 text-sm text-muted",
						children: "Belum ada setup selesai. Winrate muncul setelah TP atau SL pertama."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full min-w-xl text-left text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
								className: "text-xs text-muted",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-2 font-medium",
										children: "Waktu"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-2 font-medium",
										children: "Pair"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-2 font-medium",
										children: "Arah"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-2 font-medium",
										children: "Conf"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-2 py-2 font-medium",
										children: "Hasil"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-2 font-medium",
										children: "R"
									})
								] })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: desk.history.map((trade) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-t border-rule",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-4 py-2 font-mono text-xs text-muted",
										children: formatWhen(trade.closedAt)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "px-2 py-2 font-mono text-paper",
										children: [
											trade.pair,
											" ",
											trade.timeframe
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: trade.direction === "long" ? "px-2 py-2 text-long" : "px-2 py-2 text-short",
										children: trade.direction === "long" ? "LONG" : "SHORT"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-2 font-mono text-paper",
										children: trade.confidence
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
										className: "px-2 py-2 text-paper",
										children: outcomeText(trade)
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
										className: "px-4 py-2 font-mono " + (trade.rMultiple > 0 ? "text-long" : trade.rMultiple < 0 ? "text-short" : "text-muted"),
										children: [
											trade.rMultiple > 0 ? "+" : "",
											trade.rMultiple,
											"R"
										]
									})
								]
							}, `${trade.id}-${trade.closedAt}`)) })]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-card border border-rule bg-panel lg:col-span-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 border-b border-rule px-4 py-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Activity, { className: "size-4 text-brass" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold text-paper",
							children: "Jejak"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "flex flex-col gap-2 px-4 py-3",
						children: [desk.activity.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "text-sm text-muted",
							children: "Belum ada kunci atau penutupan."
						}) : null, desk.activity.map((note) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "text-sm text-paper",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mr-2 font-mono text-xs text-muted",
								children: formatWhen(note.at)
							}), note.text]
						}, note.id))]
					})]
				})]
			})
		]
	});
}
function Stat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-card border border-rule bg-panel px-3 py-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 font-mono text-2xl text-paper",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-xs text-muted",
				children: hint
			})
		]
	});
}
function LockedCard({ setup, open, onToggle }) {
	const span = setup.direction === "long" ? setup.tp3 - setup.sl : setup.sl - setup.tp3;
	const pos = setup.direction === "long" ? setup.currentPrice - setup.sl : setup.sl - setup.currentPrice;
	const progress = span > 0 ? Math.min(1, Math.max(0, pos / span)) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onToggle,
		className: "rounded-card border border-rule bg-panel p-3 text-left",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "font-mono text-sm text-paper",
					children: [
						setup.pair,
						" ",
						setup.timeframe
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "mt-1 block text-xs " + (setup.direction === "long" ? "text-long" : "text-short"),
					children: [
						setup.direction === "long" ? "LONG" : "SHORT",
						" · ",
						phaseLabel(setup)
					]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-mono text-xl text-brass",
						children: setup.confidence
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "block text-xs text-muted",
						children: [setup.confluence, "/7"]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Entry ", formatPrice(setup.pair, setup.entry)] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["SL ", formatPrice(setup.pair, setup.stopPrice)] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["TP1 ", formatPrice(setup.pair, setup.tp1)] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["TP2 ", formatPrice(setup.pair, setup.tp2)] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["TP3 ", formatPrice(setup.pair, setup.tp3)] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Live ", formatPrice(setup.pair, setup.currentPrice)] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-3 block h-1.5 overflow-hidden rounded-full bg-ink",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block h-full bg-brass",
					style: { width: `${progress * 100}%` }
				})
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-3 block whitespace-pre-wrap text-xs text-muted",
				children: setup.rationale
			}) : null
		]
	});
}
function RadarRow({ item, onOpen }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: onOpen,
		className: "flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "font-mono text-sm text-paper",
				children: [
					item.pair,
					" ",
					item.timeframe
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "ml-2 text-xs " + (item.direction === "long" ? "text-long" : item.direction === "short" ? "text-short" : "text-muted"),
				children: [item.direction === "long" ? "LONG" : item.direction === "short" ? "SHORT" : "—", item.confluence ? ` · ${item.confluence}/7` : ""]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-1 block text-xs text-muted",
				children: item.note
			})
		] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-lg text-brass",
			children: item.confidence
		})]
	}) });
}
function Home() {
	const initial = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScreeningDesk, { initial });
}
//#endregion
export { Home as component };

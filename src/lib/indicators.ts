function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const emas: number[] = [];
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  emas.push(seed);
  for (let i = period; i < values.length; i++) {
    emas.push(values[i] * k + emas[emas.length - 1] * (1 - k));
  }
  return emas;
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff >= 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export type MACDResult = {
  macdLine: number;
  signalLine: number;
  histogram: number;
  crossover: "bullish" | "bearish" | "none";
};

export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): MACDResult | null {
  if (closes.length < slow + signal) return null;

  const ema12 = calcEMA(closes, fast);
  const ema26 = calcEMA(closes, slow);

  const offset = slow - fast;
  const macdSeries: number[] = [];
  for (let i = 0; i < ema26.length; i++) {
    macdSeries.push(ema12[i + offset] - ema26[i]);
  }

  const signalSeries = calcEMA(macdSeries, signal);
  if (signalSeries.length < 2) return null;

  const macdLine = macdSeries[macdSeries.length - 1];
  const signalLine = signalSeries[signalSeries.length - 1];
  const histogram = macdLine - signalLine;

  const prevMacd = macdSeries[macdSeries.length - 2];
  const prevSignal = signalSeries[signalSeries.length - 2];
  let crossover: MACDResult["crossover"] = "none";
  if (prevMacd <= prevSignal && macdLine > signalLine) crossover = "bullish";
  else if (prevMacd >= prevSignal && macdLine < signalLine) crossover = "bearish";

  return { macdLine, signalLine, histogram, crossover };
}

export function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 2) return 1;
  const recent = volumes[volumes.length - 1];
  const avg = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
  if (avg === 0) return 1;
  return recent / avg;
}

export type BBResult = {
  upper: number;
  middle: number;
  lower: number;
  percentB: number;  // 0 = at lower band, 1 = at upper band; <0 or >1 = outside bands
  bandwidth: number; // (upper - lower) / middle — relative band width
  squeeze: boolean;  // bandwidth near its minimum over the full window
};

export function calcBollingerBands(closes: number[], period = 20, multiplier = 2): BBResult | null {
  if (closes.length < period) return null;

  // single pass: collect bandwidths and keep the final upper/middle/lower
  const bandwidths: number[] = [];
  let lastUpper = 0, lastMiddle = 0, lastLower = 0;

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    lastUpper  = mean + multiplier * std;
    lastLower  = mean - multiplier * std;
    lastMiddle = mean;
    bandwidths.push((lastUpper - lastLower) / mean);
  }

  const currentBW = bandwidths[bandwidths.length - 1];
  const minBW = Math.min(...bandwidths);
  // squeeze: current bandwidth within 10% of its window minimum
  const squeeze = currentBW <= minBW * 1.1;

  const price = closes[closes.length - 1];
  const percentB = lastUpper === lastLower ? 0.5 : (price - lastLower) / (lastUpper - lastLower);

  return { upper: lastUpper, middle: lastMiddle, lower: lastLower, percentB, bandwidth: currentBW, squeeze };
}

export type SignalType = "strong_buy" | "buy" | "watch_buy" | "neutral" | "watch_sell" | "sell" | "strong_sell";

export function getSignal(
  rsi: number,
  volRatio: number,
  macd?: MACDResult | null,
  bb?: BBResult | null
): SignalType {
  const macdBull = macd?.crossover === "bullish" || (macd && macd.histogram > 0);
  const macdBear = macd?.crossover === "bearish" || (macd && macd.histogram < 0);
  const bbOversold   = bb && bb.percentB < 0.2;
  const bbOverbought = bb && bb.percentB > 0.8;

  // Strong buy
  if (rsi < 30 && volRatio >= 1.5 && macdBull) return "strong_buy";
  if (rsi < 30 && volRatio >= 1.5) return "strong_buy";
  if (rsi < 35 && bb && bb.percentB < 0) return "strong_buy";   // price below lower band + oversold RSI

  // Buy
  if (rsi < 35 && volRatio >= 1.2) return "buy";
  if (rsi < 40 && macd?.crossover === "bullish" && volRatio >= 1.1) return "buy";
  if (bbOversold && macdBull && rsi < 45) return "buy";          // near lower band + MACD + RSI confirming

  // Watch buy
  if (rsi < 40 || (macd?.crossover === "bullish" && rsi < 55)) return "watch_buy";
  if (bbOversold && rsi < 45) return "watch_buy";                // RSI must be in lower zone too

  // Strong sell
  if (rsi > 75 && volRatio >= 1.5 && macdBear) return "strong_sell";
  if (rsi > 75 && volRatio >= 1.5) return "strong_sell";
  if (rsi > 65 && bb && bb.percentB > 1) return "strong_sell";  // price above upper band + overbought RSI

  // Sell
  if (rsi > 70 && volRatio >= 1.2) return "sell";
  if (rsi > 65 && macd?.crossover === "bearish") return "sell";
  if (bbOverbought && macdBear && rsi > 55) return "sell";       // near upper band + MACD + RSI confirming

  // Watch sell
  if (rsi > 60 || macd?.crossover === "bearish") return "watch_sell";
  if (bbOverbought && rsi > 55) return "watch_sell";             // RSI must be in upper zone too

  return "neutral";
}

// symmetric scale with no gap: strong_buy=3 … neutral=0 … strong_sell=-3
export function signalScore(signal: SignalType): number {
  const scores: Record<SignalType, number> = {
    strong_buy:   3,
    buy:          2,
    watch_buy:    1,
    neutral:      0,
    watch_sell:  -1,
    sell:        -2,
    strong_sell: -3,
  };
  return scores[signal];
}

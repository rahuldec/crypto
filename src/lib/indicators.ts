function calcEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const emas: number[] = [];
  // seed with SMA of first `period` values
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
  macdLine: number;   // EMA12 - EMA26
  signalLine: number; // EMA9 of macdLine
  histogram: number;  // macdLine - signalLine
  crossover: "bullish" | "bearish" | "none"; // recent crossover
};

export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): MACDResult | null {
  // need at least slow + signal candles
  if (closes.length < slow + signal) return null;

  const ema12 = calcEMA(closes, fast);
  const ema26 = calcEMA(closes, slow);

  // align: ema26 starts at index `slow-1` of closes, ema12 at `fast-1`
  // macd series starts where both overlap — offset = slow - fast
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

  // detect crossover in last 2 candles
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

export type SignalType = "strong_buy" | "buy" | "watch_buy" | "neutral" | "watch_sell" | "sell" | "strong_sell";

export function getSignal(
  rsi: number,
  volRatio: number,
  macd?: MACDResult | null
): SignalType {
  const macdBull = macd?.crossover === "bullish" || (macd && macd.histogram > 0);
  const macdBear = macd?.crossover === "bearish" || (macd && macd.histogram < 0);

  // Strong buy: oversold RSI + volume + MACD confirming
  if (rsi < 30 && volRatio >= 1.5 && macdBull) return "strong_buy";
  if (rsi < 30 && volRatio >= 1.5) return "strong_buy";
  // Buy: oversold + volume, or MACD bullish crossover + low RSI
  if (rsi < 35 && volRatio >= 1.2) return "buy";
  if (rsi < 40 && macd?.crossover === "bullish" && volRatio >= 1.1) return "buy";
  // Watch buy: either signal weakly present
  if (rsi < 45 || (macd?.crossover === "bullish" && rsi < 55)) return "watch_buy";

  // Strong sell: overbought RSI + volume + MACD confirming
  if (rsi > 75 && volRatio >= 1.5 && macdBear) return "strong_sell";
  if (rsi > 75 && volRatio >= 1.5) return "strong_sell";
  if (rsi > 70 && volRatio >= 1.2) return "sell";
  if (rsi > 65 && macd?.crossover === "bearish") return "sell";
  if (rsi > 60 || macd?.crossover === "bearish") return "watch_sell";

  return "neutral";
}

export function signalScore(signal: SignalType): number {
  const scores: Record<SignalType, number> = {
    strong_buy:  6,
    buy:         5,
    watch_buy:   4,
    neutral:     0,
    watch_sell: -1,
    sell:       -2,
    strong_sell:-3,
  };
  return scores[signal];
}

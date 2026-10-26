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
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calcVolumeRatio(volumes: number[]): number {
  if (volumes.length < 2) return 1;
  const recent = volumes[volumes.length - 1];
  const avg = volumes.slice(0, -1).reduce((a, b) => a + b, 0) / (volumes.length - 1);
  if (avg === 0) return 1;
  return recent / avg;
}

export type SignalType = "strong_buy" | "buy" | "watch_buy" | "neutral" | "watch_sell" | "sell" | "strong_sell";

export function getSignal(rsi: number, volRatio: number): SignalType {
  if (rsi < 30 && volRatio >= 1.5) return "strong_buy";
  if (rsi < 35 && volRatio >= 1.2) return "buy";
  if (rsi < 45) return "watch_buy";
  if (rsi > 75 && volRatio >= 1.5) return "strong_sell";
  if (rsi > 70 && volRatio >= 1.2) return "sell";
  if (rsi > 60) return "watch_sell";
  return "neutral";
}

export function signalScore(signal: SignalType): number {
  const scores: Record<SignalType, number> = {
    strong_buy: 6,
    buy: 5,
    watch_buy: 4,
    neutral: 0,
    watch_sell: -1,
    sell: -2,
    strong_sell: -3,
  };
  return scores[signal];
}

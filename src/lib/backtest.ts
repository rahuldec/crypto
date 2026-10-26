import { calcRSI, calcMACD, calcBollingerBands, calcVolumeRatio, getSignal } from "./indicators";

// 0.2% WazirX taker fee + 0.1% slippage, each side, baked into execution price
// Buy at open × 1.003, sell at open × 0.997 → −0.599% round-trip cost if price doesn't move
export const COST_PER_SIDE = 0.003;
export const ROUND_TRIP_PCT = COST_PER_SIDE * 2 * 100; // 0.6%

const WARMUP       = 35;  // min candles before first signal
const MAX_HOLD     = 30;  // force-exit safety valve (candles)
const TRAIN_RATIO  = 0.7; // 70% train, 30% out-of-sample test

export type Trade = {
  phase: "train" | "test";
  entryCandle: number;
  exitCandle: number;
  entryDate: number;   // unix seconds
  exitDate: number;
  entryPrice: number;  // cost-adjusted (includes fee + slippage)
  exitPrice: number;
  pnlPct: number;      // net % after all costs
  won: boolean;
  exitReason: "signal" | "timeout" | "end_of_data";
};

export type PeriodMetrics = {
  totalReturn: number;    // cumulative % from compounding every trade
  buyHold: number;        // % if held for the whole period
  alpha: number;          // totalReturn − buyHold
  trades: number;
  winRate: number;        // 0–100
  avgWin: number;         // avg winning trade %
  avgLoss: number;        // avg losing trade % (positive magnitude)
  profitFactor: number;   // gross wins ÷ gross losses
  maxDrawdown: number;    // max peak-to-trough % on equity curve
};

export type AssetResult = {
  asset: string;
  symbol: string;
  klines: number[][];
  trades: Trade[];
  trainEnd: number;      // index of first test-phase candle
  train: PeriodMetrics;
  test: PeriodMetrics;
};

function calcMetrics(
  trades: Trade[],
  klines: number[][],
  fromCandle: number,
  toCandle: number
): PeriodMetrics {
  let equity = 1, peak = 1, maxDD = 0;
  for (const t of trades) {
    equity *= 1 + t.pnlPct / 100;
    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const startPrice = klines[fromCandle]?.[4] ?? klines[0][4];
  const endPrice   = klines[Math.min(toCandle, klines.length - 1)]?.[4] ?? klines[klines.length - 1][4];
  const buyHold    = ((endPrice - startPrice) / startPrice) * 100;
  const totalReturn = (equity - 1) * 100;

  const wins    = trades.filter(t => t.won);
  const losses  = trades.filter(t => !t.won);
  const grossW  = wins.reduce((s, t) => s + t.pnlPct, 0);
  const grossL  = Math.abs(losses.reduce((s, t) => s + t.pnlPct, 0));

  return {
    totalReturn,
    buyHold,
    alpha: totalReturn - buyHold,
    trades: trades.length,
    winRate:      trades.length ? (wins.length / trades.length) * 100 : 0,
    avgWin:       wins.length   ? grossW / wins.length   : 0,
    avgLoss:      losses.length ? grossL / losses.length : 0,
    profitFactor: grossL > 0    ? grossW / grossL : (grossW > 0 ? 999 : 1),
    maxDrawdown:  maxDD * 100,
  };
}

export function runBacktest(asset: string, symbol: string, rawKlines: number[][]): AssetResult {
  const klines = rawKlines.slice(0, -1);  // drop in-progress candle
  const n = klines.length;
  const trainEnd = Math.floor(n * TRAIN_RATIO);

  const closes  = klines.map(k => k[4]);
  const opens   = klines.map(k => k[1]);
  const volumes = klines.map(k => k[5]);

  const trades: Trade[] = [];
  let inPos = false, entryCandle = 0, entryPrice = 0;

  for (let t = WARMUP; t < n - 1; t++) {
    // Walk-forward: only data[0..t] visible at signal time
    const c = closes.slice(0, t + 1);
    const v = volumes.slice(0, t + 1);
    const signal = getSignal(calcRSI(c), calcVolumeRatio(v), calcMACD(c), calcBollingerBands(c));

    const next      = t + 1;
    const execOpen  = opens[next]; // realistic: execute at next candle's open

    if (!inPos) {
      if (signal === "strong_buy" || signal === "buy") {
        entryPrice  = execOpen * (1 + COST_PER_SIDE); // pay fee + slippage to enter
        entryCandle = next;
        inPos = true;
      }
    } else {
      const held        = next - entryCandle;
      const exitSignal  = ["sell", "strong_sell", "watch_sell"].includes(signal);
      const exitTimeout = held >= MAX_HOLD;

      if ((exitSignal || exitTimeout) && held >= 1) {
        const exitPrice = execOpen * (1 - COST_PER_SIDE); // pay fee + slippage to exit
        const pnlPct    = ((exitPrice - entryPrice) / entryPrice) * 100;
        trades.push({
          phase:        entryCandle >= trainEnd ? "test" : "train",
          entryCandle, exitCandle: next,
          entryDate:    klines[entryCandle][0],
          exitDate:     klines[next][0],
          entryPrice,   exitPrice,
          pnlPct,
          won:          pnlPct > 0,
          exitReason:   exitTimeout ? "timeout" : "signal",
        });
        inPos = false;
      }
    }
  }

  // Close any position still open at end of available data
  if (inPos) {
    const exitPrice = closes[n - 1] * (1 - COST_PER_SIDE);
    const pnlPct    = ((exitPrice - entryPrice) / entryPrice) * 100;
    trades.push({
      phase:       entryCandle >= trainEnd ? "test" : "train",
      entryCandle, exitCandle: n - 1,
      entryDate:   klines[entryCandle][0],
      exitDate:    klines[n - 1][0],
      entryPrice,  exitPrice,
      pnlPct,
      won:         pnlPct > 0,
      exitReason:  "end_of_data",
    });
  }

  const trainTrades = trades.filter(t => t.phase === "train");
  const testTrades  = trades.filter(t => t.phase === "test");

  return {
    asset, symbol, klines, trades, trainEnd,
    train: calcMetrics(trainTrades, klines, WARMUP, trainEnd),
    test:  calcMetrics(testTrades,  klines, trainEnd, n - 1),
  };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticker, Kline } from "@/lib/wazirx";
import { calcRSI, calcVolumeRatio, calcMACD, getSignal, signalScore, SignalType, MACDResult } from "@/lib/indicators";

type SignalRow = {
  symbol: string;
  baseAsset: string;
  lastPrice: number;
  pct24h: number;
  rsi: number;
  volRatio: number;
  macd: MACDResult | null;
  signal: SignalType;
  score: number;
};

const SIGNAL_META: Record<SignalType, { label: string; color: string; bg: string; icon: string }> = {
  strong_buy:  { label: "Strong Buy",  color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: "▲▲" },
  buy:         { label: "Buy",         color: "text-green-700",   bg: "bg-green-50 border-green-200",     icon: "▲"  },
  watch_buy:   { label: "Watch",       color: "text-lime-700",    bg: "bg-lime-50 border-lime-200",       icon: "◈"  },
  neutral:     { label: "Neutral",     color: "text-slate-500",   bg: "bg-slate-100 border-slate-300",    icon: "—"  },
  watch_sell:  { label: "Caution",     color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     icon: "◇"  },
  sell:        { label: "Sell",        color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   icon: "▼"  },
  strong_sell: { label: "Strong Sell", color: "text-red-700",     bg: "bg-red-50 border-red-200",         icon: "▼▼" },
};

const WATCHLIST = ["btc", "eth", "bnb", "usdt", "doge"];

export default function SignalsDashboard() {
  const [rows, setRows] = useState<SignalRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "buy" | "sell">("all");
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setRows([]);
    setProgress(0);
    setError("");

    try {
      const res = await fetch("/api/tickers");
      if (!res.ok) throw new Error("Failed to fetch tickers");
      const tickers: Ticker[] = await res.json();

      const inrPairs = tickers
        .filter((t) => t.quoteAsset === "inr" && WATCHLIST.includes(t.baseAsset.toLowerCase()))
        .sort((a, b) => WATCHLIST.indexOf(a.baseAsset.toLowerCase()) - WATCHLIST.indexOf(b.baseAsset.toLowerCase()));

      setTotal(inrPairs.length);
      const results: SignalRow[] = [];

      for (let i = 0; i < inrPairs.length; i++) {
        const t = inrPairs[i];
        if (i > 0) await new Promise((r) => setTimeout(r, 1100));

        try {
          // fetch 40 daily candles — enough for MACD(12,26,9) which needs 26+9=35 min
          const kr = await fetch(`/api/klines?symbol=${t.symbol}&interval=1d&limit=40`);
          if (!kr.ok) { setProgress(i + 1); continue; }
          const klines: Kline[] = await kr.json();
          if (klines.length < 35) { setProgress(i + 1); continue; }

          const closes = klines.map((k) => k[4]);
          const volumes = klines.map((k) => k[5]);

          const rsi = calcRSI(closes);
          const volRatio = calcVolumeRatio(volumes);
          const macd = calcMACD(closes);
          const signal = getSignal(rsi, volRatio, macd);
          const score = signalScore(signal);

          const open = parseFloat(t.openPrice);
          const last = parseFloat(t.lastPrice);
          const pct24h = open > 0 ? ((last - open) / open) * 100 : 0;

          results.push({ symbol: t.symbol, baseAsset: t.baseAsset, lastPrice: last, pct24h, rsi: Math.round(rsi * 10) / 10, volRatio: Math.round(volRatio * 100) / 100, macd, signal, score });
          results.sort((a, b) => b.score - a.score || b.volRatio - a.volRatio);
          setRows([...results]);
        } catch { /* skip */ }

        setProgress(i + 1);
      }

      setLastRun(new Date());
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => { runAnalysis(); }, [runAnalysis]);

  const filtered = rows.filter((r) => {
    if (filter === "buy")  return ["strong_buy", "buy", "watch_buy"].includes(r.signal);
    if (filter === "sell") return ["strong_sell", "sell", "watch_sell"].includes(r.signal);
    return true;
  });

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-600 text-sm">{error}</div>
  );

  return (
    <div className="space-y-6">
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between text-sm text-slate-500 mb-3">
            <span>Analyzing {total} coins…</span>
            <span>{progress}/{total}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-2">Fetching 40-day klines · Computing RSI(14) + MACD(12,26,9) + Volume ratio · ~30s</p>
        </div>
      )}

      {/* Legend — always visible */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wide">MACD Legend</div>
          <div className="space-y-2 text-xs">
            {[
              { icon: "⬆", label: "Cross (Bullish)", desc: "MACD just crossed above signal line — momentum turning bullish right now", color: "text-emerald-600" },
              { icon: "▲", label: "Bull",            desc: "MACD above signal line — ongoing uptrend",                                  color: "text-green-600"   },
              { icon: "▼", label: "Bear",            desc: "MACD below signal line — ongoing downtrend",                                color: "text-slate-500"   },
              { icon: "⬇", label: "Cross (Bearish)", desc: "MACD just crossed below signal line — sell signal",                        color: "text-red-500"     },
            ].map(({ icon, label, desc, color }) => (
              <div key={label} className="flex gap-3 items-start">
                <span className={`font-bold w-4 shrink-0 ${color}`}>{icon}</span>
                <div>
                  <span className={`font-medium ${color}`}>{label}</span>
                  <span className="text-slate-400"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-slate-500 text-xs font-medium mb-3 uppercase tracking-wide">RSI Legend</div>
          <div className="space-y-2 text-xs">
            {[
              { range: "< 30",  label: "Oversold",   desc: "Strong buy zone — price may bounce",      color: "text-emerald-600" },
              { range: "30–45", label: "Low",         desc: "Watch for buy signals with confirmation", color: "text-green-600"   },
              { range: "45–60", label: "Neutral",     desc: "No clear directional edge",               color: "text-slate-500"   },
              { range: "60–70", label: "High",        desc: "Momentum strong, watch for reversal",     color: "text-amber-600"   },
              { range: "> 70",  label: "Overbought",  desc: "Sell zone — price may pull back",         color: "text-red-500"     },
            ].map(({ range, label, desc, color }) => (
              <div key={range} className="flex gap-3 items-start">
                <span className={`font-mono font-medium w-12 shrink-0 ${color}`}>{range}</span>
                <div>
                  <span className={`font-medium ${color}`}>{label}</span>
                  <span className="text-slate-400"> — {desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Strong Buy", sig: "strong_buy", color: "emerald" },
              { label: "Buy",        sig: "buy",        color: "green"   },
              { label: "Sell",       sig: "sell,strong_sell", color: "red" },
              { label: "Neutral",    sig: "neutral",    color: "slate"   },
            ].map(({ label, sig, color }) => {
              const count = rows.filter(r => sig.split(",").includes(r.signal)).length;
              return (
                <div key={label} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4`}>
                  <div className={`text-${color}-600 text-xs mb-1`}>{label}</div>
                  <div className="text-2xl font-bold text-slate-900">{count}</div>
                </div>
              );
            })}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            ⚠️ RSI(14) + MACD(12,26,9) + Volume ratio are technical indicators only — not financial advice. Always do your own research.
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {(["all", "buy", "sell"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:text-slate-800"}`}>
                {f === "all" ? "All signals" : f === "buy" ? "Buy only" : "Sell only"}
              </button>
            ))}
            <button onClick={runAnalysis} disabled={loading}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:text-slate-800 disabled:opacity-40 transition-colors">
              {loading ? "Scanning…" : "↺ Re-scan"}
            </button>
            {lastRun && !loading && <span className="text-xs text-slate-400">Last scan: {lastRun.toLocaleTimeString()}</span>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-200">
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 pr-4 font-medium">Coin</th>
                  <th className="text-left py-2 px-3 font-medium">Signal</th>
                  <th className="text-right py-2 px-3 font-medium">RSI(14)</th>
                  <th className="text-center py-2 px-3 font-medium">MACD</th>
                  <th className="text-right py-2 px-3 font-medium">Vol Ratio</th>
                  <th className="text-right py-2 px-3 font-medium">Price</th>
                  <th className="text-right py-2 pl-3 font-medium">24h</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const meta = SIGNAL_META[r.signal];
                  const pos = r.pct24h >= 0;
                  const macdColor = r.macd?.crossover === "bullish" ? "text-emerald-600"
                    : r.macd?.crossover === "bearish" ? "text-red-500"
                    : r.macd && r.macd.histogram > 0 ? "text-green-600"
                    : "text-slate-400";
                  const macdLabel = r.macd?.crossover === "bullish" ? "⬆ Cross"
                    : r.macd?.crossover === "bearish" ? "⬇ Cross"
                    : r.macd && r.macd.histogram > 0 ? "▲ Bull"
                    : r.macd && r.macd.histogram < 0 ? "▼ Bear"
                    : "—";

                  return (
                    <tr key={r.symbol} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                            {r.baseAsset.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{r.baseAsset.toUpperCase()}</div>
                            <div className="text-xs text-slate-400">{r.symbol.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${meta.bg} ${meta.color}`}>
                          <span className="text-[10px]">{meta.icon}</span>{meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${r.rsi < 30 ? "bg-emerald-500" : r.rsi > 70 ? "bg-red-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(r.rsi, 100)}%` }} />
                          </div>
                          <span className={`font-mono text-sm w-9 text-right ${r.rsi < 30 ? "text-emerald-600" : r.rsi > 70 ? "text-red-500" : "text-slate-700"}`}>
                            {r.rsi}
                          </span>
                        </div>
                      </td>
                      <td className={`py-3 px-3 text-center text-xs font-medium ${macdColor}`}>
                        <div>{macdLabel}</div>
                        {r.macd && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            {r.macd.histogram > 0 ? "+" : ""}{r.macd.histogram.toFixed(4)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-mono text-sm ${r.volRatio >= 1.5 ? "text-amber-600" : r.volRatio >= 1.2 ? "text-slate-700" : "text-slate-400"}`}>
                          {r.volRatio}×
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 text-sm">
                        ₹{r.lastPrice >= 1000
                          ? r.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })
                          : r.lastPrice < 1 ? r.lastPrice.toFixed(6)
                          : r.lastPrice.toFixed(2)}
                      </td>
                      <td className={`py-3 pl-3 text-right font-medium text-sm ${pos ? "text-green-600" : "text-red-500"}`}>
                        {pos ? "+" : ""}{r.pct24h.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className="text-center text-slate-400 text-sm py-12">No signal data yet.</div>
      )}
    </div>
  );
}

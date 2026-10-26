"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticker, Kline } from "@/lib/wazirx";
import { calcRSI, calcVolumeRatio, getSignal, signalScore, SignalType } from "@/lib/indicators";

type SignalRow = {
  symbol: string;
  baseAsset: string;
  lastPrice: number;
  pct24h: number;
  rsi: number;
  volRatio: number;
  signal: SignalType;
  score: number;
};

const SIGNAL_META: Record<SignalType, { label: string; color: string; bg: string; icon: string }> = {
  strong_buy:  { label: "Strong Buy",  color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: "▲▲" },
  buy:         { label: "Buy",         color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30",     icon: "▲"  },
  watch_buy:   { label: "Watch",       color: "text-lime-400",    bg: "bg-lime-400/10 border-lime-400/30",       icon: "◈"  },
  neutral:     { label: "Neutral",     color: "text-slate-400",   bg: "bg-slate-700/30 border-slate-600/30",    icon: "—"  },
  watch_sell:  { label: "Caution",     color: "text-amber-400",   bg: "bg-amber-400/10 border-amber-400/30",    icon: "◇"  },
  sell:        { label: "Sell",        color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/30",  icon: "▼"  },
  strong_sell: { label: "Strong Sell", color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30",        icon: "▼▼" },
};

const TOP_N = 25;

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
        .filter((t) => t.quoteAsset === "inr" && parseFloat(t.volume) > 0)
        .sort((a, b) => parseFloat(b.volume) * parseFloat(b.lastPrice) - parseFloat(a.volume) * parseFloat(a.lastPrice))
        .slice(0, TOP_N);

      setTotal(inrPairs.length);

      const results: SignalRow[] = [];

      for (let i = 0; i < inrPairs.length; i++) {
        const t = inrPairs[i];

        if (i > 0) await new Promise((r) => setTimeout(r, 1100));

        try {
          const kr = await fetch(`/api/klines?symbol=${t.symbol}&interval=1d&limit=21`);
          if (!kr.ok) { setProgress(i + 1); continue; }
          const klines: Kline[] = await kr.json();
          if (klines.length < 15) { setProgress(i + 1); continue; }

          const closes = klines.map((k) => k[4]);
          const volumes = klines.map((k) => k[5]);

          const rsi = calcRSI(closes);
          const volRatio = calcVolumeRatio(volumes);
          const signal = getSignal(rsi, volRatio);
          const score = signalScore(signal);

          const open = parseFloat(t.openPrice);
          const last = parseFloat(t.lastPrice);
          const pct24h = open > 0 ? ((last - open) / open) * 100 : 0;

          const row: SignalRow = {
            symbol: t.symbol,
            baseAsset: t.baseAsset,
            lastPrice: last,
            pct24h,
            rsi: Math.round(rsi * 10) / 10,
            volRatio: Math.round(volRatio * 100) / 100,
            signal,
            score,
          };

          results.push(row);
          results.sort((a, b) => b.score - a.score || b.volRatio - a.volRatio);
          setRows([...results]);
        } catch {
          // skip this coin
        }

        setProgress(i + 1);
      }

      setLastRun(new Date());
    } catch (e) {
      setError(String(e));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    runAnalysis();
  }, [runAnalysis]);

  const filtered = rows.filter((r) => {
    if (filter === "buy") return ["strong_buy", "buy", "watch_buy"].includes(r.signal);
    if (filter === "sell") return ["strong_sell", "sell", "watch_sell"].includes(r.signal);
    return true;
  });

  const buys = rows.filter((r) => ["strong_buy", "buy"].includes(r.signal));
  const sells = rows.filter((r) => ["strong_sell", "sell"].includes(r.signal));

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  if (error) {
    return (
      <div className="rounded-xl bg-red-900/30 border border-red-700/50 p-4 text-red-300 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      {loading && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="flex justify-between text-sm text-slate-400 mb-3">
            <span>Analyzing top {total} coins by volume…</span>
            <span>{progress}/{total}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Fetching 21-day klines and calculating RSI(14) + volume ratio for each coin. Takes ~30s.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-400/10 border border-emerald-400/30 rounded-xl p-4">
              <div className="text-emerald-400 text-xs mb-1">Strong Buy signals</div>
              <div className="text-2xl font-bold text-white">{buys.filter(r => r.signal === "strong_buy").length}</div>
            </div>
            <div className="bg-green-400/10 border border-green-400/30 rounded-xl p-4">
              <div className="text-green-400 text-xs mb-1">Buy signals</div>
              <div className="text-2xl font-bold text-white">{buys.filter(r => r.signal === "buy").length}</div>
            </div>
            <div className="bg-red-400/10 border border-red-400/30 rounded-xl p-4">
              <div className="text-red-400 text-xs mb-1">Sell signals</div>
              <div className="text-2xl font-bold text-white">{sells.length}</div>
            </div>
            <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4">
              <div className="text-slate-400 text-xs mb-1">Neutral</div>
              <div className="text-2xl font-bold text-white">{rows.filter(r => r.signal === "neutral").length}</div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-3 text-xs text-amber-300/80">
            ⚠️ These are technical indicators only — RSI(14) + volume ratio. Not financial advice. Always do your own research.
          </div>

          {/* Filter + refresh */}
          <div className="flex items-center gap-3 flex-wrap">
            {(["all", "buy", "sell"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  filter === f ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {f === "all" ? "All signals" : f === "buy" ? "Buy only" : "Sell only"}
              </button>
            ))}
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors"
            >
              {loading ? "Scanning…" : "↺ Re-scan"}
            </button>
            {lastRun && !loading && (
              <span className="text-xs text-slate-500">Last scan: {lastRun.toLocaleTimeString()}</span>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs border-b border-slate-800">
                  <th className="text-left py-2 pr-4 font-medium">#</th>
                  <th className="text-left py-2 pr-4 font-medium">Coin</th>
                  <th className="text-left py-2 px-4 font-medium">Signal</th>
                  <th className="text-right py-2 px-4 font-medium">RSI(14)</th>
                  <th className="text-right py-2 px-4 font-medium">Vol Ratio</th>
                  <th className="text-right py-2 px-4 font-medium">Price (INR)</th>
                  <th className="text-right py-2 pl-4 font-medium">24h</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const meta = SIGNAL_META[r.signal];
                  const pos = r.pct24h >= 0;
                  return (
                    <tr key={r.symbol} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4 text-slate-600 text-xs">{i + 1}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                            {r.baseAsset.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-200">{r.baseAsset.toUpperCase()}</div>
                            <div className="text-xs text-slate-500">{r.symbol.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${meta.bg} ${meta.color}`}>
                          <span className="text-[10px]">{meta.icon}</span>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 bg-slate-800 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${r.rsi < 30 ? "bg-emerald-500" : r.rsi > 70 ? "bg-red-500" : "bg-blue-500"}`}
                              style={{ width: `${Math.min(r.rsi, 100)}%` }}
                            />
                          </div>
                          <span className={`font-mono text-sm w-10 text-right ${r.rsi < 30 ? "text-emerald-400" : r.rsi > 70 ? "text-red-400" : "text-slate-300"}`}>
                            {r.rsi}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-mono text-sm ${r.volRatio >= 1.5 ? "text-amber-400" : r.volRatio >= 1.2 ? "text-slate-300" : "text-slate-500"}`}>
                          {r.volRatio}×
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        ₹{r.lastPrice >= 1000
                          ? r.lastPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })
                          : r.lastPrice < 1
                          ? r.lastPrice.toFixed(6)
                          : r.lastPrice.toFixed(2)}
                      </td>
                      <td className={`py-3 pl-4 text-right font-medium ${pos ? "text-green-400" : "text-red-400"}`}>
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
        <div className="text-center text-slate-500 text-sm py-12">No signal data yet.</div>
      )}
    </div>
  );
}

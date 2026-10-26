"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { runBacktest, AssetResult, PeriodMetrics, ROUND_TRIP_PCT } from "@/lib/backtest";

const ASSETS = [
  { asset: "BTC",  symbol: "btcinr"  },
  { asset: "ETH",  symbol: "ethinr"  },
  { asset: "BNB",  symbol: "bnbinr"  },
  { asset: "DOGE", symbol: "dogeinr" },
];

function fmt(n: number, dec = 2) {
  return n.toFixed(dec);
}

function PnlCell({ v, suffix = "%" }: { v: number; suffix?: string }) {
  const cls = v > 0 ? "text-green-600" : v < 0 ? "text-red-500" : "text-slate-400";
  return (
    <td className={`py-3 px-3 text-right font-mono text-sm tabular-nums ${cls}`}>
      {v > 0 ? "+" : ""}{fmt(v)}{suffix}
    </td>
  );
}

function NeutralCell({ v, suffix = "" }: { v: number | string; suffix?: string }) {
  return (
    <td className="py-3 px-3 text-right font-mono text-sm text-slate-700 tabular-nums">
      {v}{suffix}
    </td>
  );
}

function PeriodSection({ label, badge, results, phase }: {
  label: string;
  badge?: string;
  results: AssetResult[];
  phase: "train" | "test";
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-800">{label}</h2>
        {badge && (
          <span className="text-xs bg-violet-50 border border-violet-200 text-violet-700 px-2 py-0.5 rounded-md font-medium">
            {badge}
          </span>
        )}
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-400 font-medium">
              <th className="text-left py-2 pr-4 pl-1">Asset</th>
              <th className="text-right py-2 px-3">Return</th>
              <th className="text-right py-2 px-3">vs Hold</th>
              <th className="text-right py-2 px-3">B&amp;H</th>
              <th className="text-right py-2 px-3">Trades</th>
              <th className="text-right py-2 px-3">Win %</th>
              <th className="text-right py-2 px-3">Avg Win</th>
              <th className="text-right py-2 px-3">Avg Loss</th>
              <th className="text-right py-2 px-3">Max DD</th>
              <th className="text-right py-2 pl-3 pr-1">PF</th>
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const m: PeriodMetrics = phase === "train" ? r.train : r.test;
              const pf = m.profitFactor >= 999 ? "∞" : fmt(m.profitFactor);
              return (
                <tr key={r.asset} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 pr-4 pl-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                        {r.asset.slice(0, 2)}
                      </div>
                      <span className="font-medium text-slate-800">{r.asset}</span>
                    </div>
                  </td>
                  <PnlCell v={m.totalReturn} />
                  <PnlCell v={m.alpha} />
                  <PnlCell v={m.buyHold} />
                  <NeutralCell v={m.trades} />
                  <NeutralCell v={fmt(m.winRate)} suffix="%" />
                  <td className="py-3 px-3 text-right font-mono text-sm tabular-nums text-green-600">
                    {m.avgWin > 0 ? `+${fmt(m.avgWin)}%` : "—"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm tabular-nums text-red-500">
                    {m.avgLoss > 0 ? `−${fmt(m.avgLoss)}%` : "—"}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-sm tabular-nums text-red-500">
                    {m.maxDrawdown > 0 ? `−${fmt(m.maxDrawdown)}%` : "—"}
                  </td>
                  <td className={`py-3 pl-3 pr-1 text-right font-mono text-sm tabular-nums ${Number(pf) >= 1 || pf === "∞" ? "text-green-600" : "text-red-500"}`}>
                    {pf}×
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EquityCurve({ trades }: { trades: AssetResult["trades"] }) {
  const points: number[] = [0];
  let eq = 1;
  for (const t of trades) {
    eq *= 1 + t.pnlPct / 100;
    points.push((eq - 1) * 100);
  }
  if (points.length < 2) return <span className="text-xs text-slate-400">no trades</span>;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const W = 120, H = 28;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p - min) / range) * H;
    return `${x},${y}`;
  }).join(" ");

  const last = points[points.length - 1];
  const color = last >= 0 ? "#16a34a" : "#ef4444";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-[120px] h-7 shrink-0" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export default function BacktestDashboard() {
  const [results, setResults]   = useState<AssetResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const scanRef = useRef(false);

  const run = useCallback(async (force = false) => {
    if (scanRef.current && !force) return;
    scanRef.current = true;
    setLoading(true);
    setResults([]);
    setProgress(0);
    setError("");

    try {
      const collected: AssetResult[] = [];
      for (let i = 0; i < ASSETS.length; i++) {
        if (i > 0) await new Promise(r => setTimeout(r, 1200));
        const { asset, symbol } = ASSETS[i];
        const res = await fetch(`/api/klines?symbol=${symbol}&interval=1d&limit=500`);
        if (!res.ok) { setProgress(i + 1); continue; }
        const klines = await res.json();
        if (!Array.isArray(klines) || klines.length < 40) { setProgress(i + 1); continue; }
        const result = runBacktest(asset, symbol, klines);
        collected.push(result);
        setResults([...collected]);
        setProgress(i + 1);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
    scanRef.current = false;
  }, []);

  useEffect(() => { run(); }, [run]);

  const pct = Math.round((progress / ASSETS.length) * 100);

  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-600 text-sm">{error}</div>
  );

  return (
    <div className="space-y-6">
      {/* Methodology banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <div className="font-semibold text-blue-900 text-sm mb-1.5">How this works</div>
        <div>· <b>Walk-forward:</b> each signal is generated using only candles available at that moment — zero lookahead</div>
        <div>· <b>Execution:</b> entry and exit at the <em>next</em> day's open price — same-candle fills are never assumed</div>
        <div>· <b>Costs:</b> 0.2% WazirX fee + 0.1% slippage each way = {fmt(ROUND_TRIP_PCT, 1)}% round-trip, baked into every trade price</div>
        <div>· <b>Split:</b> first 70% of candles = training (tuning signal), final 30% = unseen test data</div>
        <div>· <b>Force-exit:</b> open positions closed after 30 candles if no sell signal fires</div>
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between text-sm text-slate-500 mb-3">
            <span>Backtesting {ASSETS.length} assets…</span>
            <span>{progress} / {ASSETS.length}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Fetching 500-day daily klines · Walk-forward signal generation · ~5s per asset
          </p>
        </div>
      )}

      {/* Results tables */}
      {results.length > 0 && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <PeriodSection
                label="Training period (in-sample · first 70%)"
                results={results}
                phase="train"
              />
            </div>
            <div className="p-5">
              <PeriodSection
                label="Test period (out-of-sample · final 30%, never seen during tuning)"
                badge="Out-of-sample"
                results={results}
                phase="test"
              />
            </div>
          </div>

          {/* Date ranges + equity curves */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {results.map(r => {
              const fmt_d = (ts: number) =>
                new Date(ts * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
              const trainStart = fmt_d(r.klines[0][0]);
              const splitDate  = fmt_d(r.klines[r.trainEnd][0]);
              const endDate    = fmt_d(r.klines[r.klines.length - 1][0]);
              const testTrades = r.trades.filter(t => t.phase === "test");
              return (
                <div key={r.asset} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-800 text-sm">{r.asset}</span>
                    <EquityCurve trades={r.trades} />
                  </div>
                  <div className="space-y-0.5 text-xs text-slate-500">
                    <div>Train: {trainStart} – {splitDate}</div>
                    <div>Test: {splitDate} – {endDate}</div>
                    <div className="text-slate-400">{r.klines.length} candles · {r.trades.length} trades ({testTrades.length} in test)</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trade logs */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Individual trades</div>
            {results.map(r => (
              <div key={r.asset} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(expanded === r.asset ? null : r.asset)}
                >
                  <span>
                    {r.asset} — {r.trades.length} trades
                    <span className="ml-2 text-xs text-slate-400">
                      ({r.trades.filter(t => t.phase === "test").length} in test set)
                    </span>
                  </span>
                  <span className="text-slate-400 text-xs">{expanded === r.asset ? "▲" : "▼"}</span>
                </button>

                {expanded === r.asset && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-xs min-w-[580px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-medium">
                          <th className="text-left py-2 px-3">Phase</th>
                          <th className="text-left py-2 px-3">Entry</th>
                          <th className="text-left py-2 px-3">Exit</th>
                          <th className="text-right py-2 px-3">Days</th>
                          <th className="text-right py-2 px-3">P&amp;L</th>
                          <th className="text-left py-2 px-3">Exit reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.trades.map((t, i) => (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 ${t.phase === "test" ? "bg-violet-50/40" : ""}`}
                          >
                            <td className="py-2 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                t.phase === "test"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}>
                                {t.phase}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {new Date(t.entryDate * 1000).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short", year: "2-digit",
                              })}
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-mono">
                              {new Date(t.exitDate * 1000).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short", year: "2-digit",
                              })}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-600 font-mono">
                              {t.exitCandle - t.entryCandle}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono font-medium ${
                              t.won ? "text-green-600" : "text-red-500"
                            }`}>
                              {t.pnlPct > 0 ? "+" : ""}{fmt(t.pnlPct)}%
                            </td>
                            <td className="py-2 px-3 text-slate-400">{t.exitReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && results.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-16">No results available.</div>
      )}

      {/* Footer controls */}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 disabled:opacity-40 transition-colors"
        >
          {loading ? "Running…" : "↺ Re-run"}
        </button>
        <span className="text-xs text-slate-400">
          Round-trip cost: {fmt(ROUND_TRIP_PCT, 1)}% (fee + slippage) · 500-day daily klines
        </span>
      </div>
    </div>
  );
}

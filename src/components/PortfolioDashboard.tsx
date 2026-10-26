"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Fund, Ticker } from "@/lib/wazirx";

interface HoldingRow {
  asset: string;
  free: number;
  locked: number;
  total: number;
  priceInr: number;
  valueInr: number;
  pct24h: number;
}

function pctChange(open: string, last: string): number {
  const o = parseFloat(open);
  const l = parseFloat(last);
  if (!o) return 0;
  return ((l - o) / o) * 100;
}

export default function PortfolioDashboard() {
  const [holdings, setHoldings] = useState<HoldingRow[]>([]);
  const [totalInr, setTotalInr] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasData = useRef(false);

  const fetchPortfolio = useCallback(async () => {
    try {
      const [fundsRes, tickersRes] = await Promise.all([
        fetch("/api/funds"),
        fetch("/api/tickers"),
      ]);

      if (!fundsRes.ok) {
        const err = await fundsRes.json();
        setLoading(false);
        if (!hasData.current) setError(err.error ?? "Failed to fetch funds");
        return;
      }

      const funds: Fund[] = await fundsRes.json();
      const tickers: Ticker[] = await tickersRes.json();

      const tickerMap = new Map(tickers.map((t) => [t.baseAsset.toLowerCase(), t]));

      const rows: HoldingRow[] = [];
      let total = 0;

      for (const fund of funds) {
        const free = parseFloat(fund.free);
        const locked = parseFloat(fund.locked);
        const qty = free + locked;
        if (qty === 0) continue;

        const asset = fund.asset.toLowerCase();
        let priceInr = 0;
        let pct = 0;

        if (asset === "inr") {
          priceInr = 1;
        } else {
          const ticker = tickerMap.get(asset);
          if (ticker) {
            priceInr = parseFloat(ticker.lastPrice);
            pct = pctChange(ticker.openPrice, ticker.lastPrice);
          }
        }

        const valueInr = qty * priceInr;
        total += valueInr;

        rows.push({ asset: fund.asset, free, locked, total: qty, priceInr, valueInr, pct24h: pct });
      }

      rows.sort((a, b) => b.valueInr - a.valueInr);
      hasData.current = true;
      setHoldings(rows);
      setTotalInr(total);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const id = setInterval(fetchPortfolio, 30000);
    return () => clearInterval(id);
  }, [fetchPortfolio]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Loading portfolio...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-900/30 border border-red-700/50 p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  const topHoldings = holdings.slice(0, 5);
  const topPct = topHoldings.reduce((s, h) => s + h.valueInr, 0) / totalInr;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="text-slate-400 text-xs mb-1">Total Portfolio Value</div>
          <div className="text-2xl font-bold text-white">
            ₹{totalInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          {lastUpdated && (
            <div className="text-xs text-slate-500 mt-1">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="text-slate-400 text-xs mb-1">Assets Held</div>
          <div className="text-2xl font-bold text-white">{holdings.length}</div>
          <div className="text-xs text-slate-500 mt-1">across all coins</div>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
          <div className="text-slate-400 text-xs mb-1">Top 5 Concentration</div>
          <div className="text-2xl font-bold text-white">{(topPct * 100).toFixed(1)}%</div>
          <div className="text-xs text-slate-500 mt-1">
            {topHoldings.map((h) => h.asset).join(", ")}
          </div>
        </div>
      </div>

      {/* Allocation bar */}
      {holdings.length > 0 && (
        <div>
          <div className="text-xs text-slate-400 mb-2">Allocation</div>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {holdings.slice(0, 8).map((h, i) => {
              const colors = [
                "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500",
                "bg-red-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
              ];
              const pct = totalInr > 0 ? (h.valueInr / totalInr) * 100 : 0;
              return (
                <div
                  key={h.asset}
                  className={`${colors[i]} transition-all`}
                  style={{ width: `${pct}%` }}
                  title={`${h.asset}: ${pct.toFixed(1)}%`}
                />
              );
            })}
            {holdings.length > 8 && (
              <div
                className="bg-slate-600 flex-1"
                title="Others"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {holdings.slice(0, 8).map((h, i) => {
              const colors = [
                "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500",
                "bg-red-500", "bg-cyan-500", "bg-pink-500", "bg-indigo-500",
              ];
              const pct = totalInr > 0 ? (h.valueInr / totalInr) * 100 : 0;
              return (
                <div key={h.asset} className="flex items-center gap-1 text-xs text-slate-400">
                  <div className={`w-2 h-2 rounded-full ${colors[i]}`} />
                  {h.asset} {pct.toFixed(1)}%
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Holdings table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-800">
              <th className="text-left py-2 pr-4 font-medium">Asset</th>
              <th className="text-right py-2 px-4 font-medium">Qty</th>
              <th className="text-right py-2 px-4 font-medium">Price (INR)</th>
              <th className="text-right py-2 px-4 font-medium">Value (INR)</th>
              <th className="text-right py-2 px-4 font-medium">24h</th>
              <th className="text-right py-2 pl-4 font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const share = totalInr > 0 ? (h.valueInr / totalInr) * 100 : 0;
              const pos = h.pct24h >= 0;
              return (
                <tr key={h.asset} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        {h.asset.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="font-medium text-slate-200">{h.asset}</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    {h.total.toLocaleString("en-IN", { maximumFractionDigits: 8 })}
                    {h.locked > 0 && (
                      <span className="text-xs text-slate-500 ml-1">({h.locked.toFixed(4)} locked)</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-300">
                    {h.priceInr > 0 ? `₹${h.priceInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                    ₹{h.valueInr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-4 text-right font-medium text-sm ${pos ? "text-green-400" : h.pct24h === 0 ? "text-slate-500" : "text-red-400"}`}>
                    {h.pct24h === 0 ? "—" : `${pos ? "+" : ""}${h.pct24h.toFixed(2)}%`}
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                      <span className="text-slate-400 text-xs w-10 text-right">{share.toFixed(1)}%</span>
                    </div>
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

"use client";

import { useState, useEffect, useCallback } from "react";
import { Ticker } from "@/lib/wazirx";
import SparklineChart from "./SparklineChart";

function pctChange(open: string, last: string): number {
  const o = parseFloat(open);
  const l = parseFloat(last);
  if (!o) return 0;
  return ((l - o) / o) * 100;
}

function fmt(n: string, digits = 2): string {
  const v = parseFloat(n);
  if (v >= 1000) return v.toLocaleString("en-IN", { maximumFractionDigits: digits });
  return v.toFixed(Math.max(digits, v < 1 ? 6 : 2));
}

export default function MarketTable() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"pct" | "vol" | "price">("pct");
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchTickers = useCallback(async () => {
    const res = await fetch("/api/tickers");
    if (!res.ok) return;
    const data: Ticker[] = await res.json();
    setTickers(data.filter((t) => t.quoteAsset === "inr"));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTickers();
    const id = setInterval(fetchTickers, 15000);
    return () => clearInterval(id);
  }, [fetchTickers]);

  useEffect(() => {
    const top = tickers
      .slice()
      .sort((a, b) => parseFloat(b.volume) * parseFloat(b.lastPrice) - parseFloat(a.volume) * parseFloat(a.lastPrice))
      .slice(0, 12);

    top.forEach(async (t) => {
      if (sparklines[t.symbol]) return;
      const res = await fetch(`/api/klines?symbol=${t.symbol}`);
      if (!res.ok) return;
      const klines: number[][] = await res.json();
      setSparklines((prev) => ({
        ...prev,
        [t.symbol]: klines.map((k) => k[4]),
      }));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers]);

  const filtered = tickers
    .filter((t) =>
      !search || t.baseAsset.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "pct") return pctChange(b.openPrice, b.lastPrice) - pctChange(a.openPrice, a.lastPrice);
      if (sort === "vol") return parseFloat(b.volume) * parseFloat(b.lastPrice) - parseFloat(a.volume) * parseFloat(a.lastPrice);
      return parseFloat(b.lastPrice) - parseFloat(a.lastPrice);
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Loading market data...
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <input
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 w-48 shadow-sm"
          placeholder="Search coin..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {(["pct", "vol", "price"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sort === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:text-slate-800"
              }`}
            >
              {s === "pct" ? "% Change" : s === "vol" ? "Volume" : "Price"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400">Auto-refreshes every 15s</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-500 text-xs border-b border-slate-200">
              <th className="text-left py-2 pr-4 font-medium">Coin</th>
              <th className="text-right py-2 px-4 font-medium">Last Price</th>
              <th className="text-right py-2 px-4 font-medium">24h Change</th>
              <th className="text-right py-2 px-4 font-medium">High</th>
              <th className="text-right py-2 px-4 font-medium">Low</th>
              <th className="text-right py-2 px-4 font-medium">Volume</th>
              <th className="text-right py-2 pl-4 font-medium w-28">24h Chart</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const pct = pctChange(t.openPrice, t.lastPrice);
              const pos = pct >= 0;
              return (
                <tr key={t.symbol} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                        {t.baseAsset.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{t.baseAsset.toUpperCase()}</div>
                        <div className="text-xs text-slate-400">{t.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-800">
                    ₹{fmt(t.lastPrice)}
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${pos ? "text-green-600" : "text-red-500"}`}>
                    {pos ? "+" : ""}{pct.toFixed(2)}%
                  </td>
                  <td className="py-3 px-4 text-right text-slate-500 font-mono">₹{fmt(t.highPrice)}</td>
                  <td className="py-3 px-4 text-right text-slate-500 font-mono">₹{fmt(t.lowPrice)}</td>
                  <td className="py-3 px-4 text-right text-slate-500">
                    {parseFloat(t.volume).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-3 pl-4 w-28">
                    {sparklines[t.symbol] ? (
                      <SparklineChart data={sparklines[t.symbol]} positive={pos} />
                    ) : (
                      <div className="h-10 bg-slate-100 rounded animate-pulse" />
                    )}
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

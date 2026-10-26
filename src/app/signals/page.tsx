import SignalsDashboard from "@/components/SignalsDashboard";

export default function SignalsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Signals</h1>
        <p className="text-slate-500 text-sm mt-1">
          RSI(14) · MACD(12,26,9) · BB(20,2) screening for BTC, ETH, BNB, USDT, DOGE
        </p>
      </div>
      <SignalsDashboard />
    </div>
  );
}

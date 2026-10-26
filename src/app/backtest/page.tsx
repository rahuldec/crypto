import BacktestDashboard from "@/components/BacktestDashboard";

export default function BacktestPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Backtest</h1>
        <p className="text-slate-500 text-sm mt-1">
          Walk-forward historical simulation · 70% train, 30% out-of-sample · 0.6% round-trip costs
        </p>
      </div>
      <BacktestDashboard />
    </div>
  );
}

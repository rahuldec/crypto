import SignalsDashboard from "@/components/SignalsDashboard";

export default function SignalsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Signals</h1>
        <p className="text-slate-400 text-sm mt-1">
          RSI(14) + volume screening across top 25 INR pairs
        </p>
      </div>
      <SignalsDashboard />
    </div>
  );
}

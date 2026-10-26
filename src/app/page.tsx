import PortfolioDashboard from "@/components/PortfolioDashboard";

export default function PortfolioPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Portfolio</h1>
        <p className="text-slate-500 text-sm mt-1">Your WazirX holdings at current market prices</p>
      </div>
      <PortfolioDashboard />
    </div>
  );
}

import MarketTable from "@/components/MarketTable";

export default function MarketPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Market</h1>
        <p className="text-slate-500 text-sm mt-1">Live INR market prices from WazirX</p>
      </div>
      <MarketTable />
    </div>
  );
}

import { Users, DollarSign, Home, BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export async function DemographicSnapshot({ zipCode }: { zipCode: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("census_demographics").select("zip_code, population, median_household_income, renter_occupied_pct, median_age").eq("zip_code", zipCode).limit(1);
  if (!data || data.length === 0) return null;
  const demo = data[0];
  if (!demo.population && !demo.median_household_income && !demo.renter_occupied_pct) return null;

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-[#3B82F6]" />
        <h2 className="text-lg font-bold text-[#0F1D2E]">Demographics</h2>
      </div>
      <p className="text-xs text-[#94a3b8] mb-4">U.S. Census ACS estimates</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {demo.population && <div><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-[#3B82F6]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Population</span></div><p className="text-xl font-bold text-[#0F1D2E]">{demo.population.toLocaleString()}</p></div>}
        {demo.median_household_income && <div><div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3.5 h-3.5 text-[#10B981]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Median Income</span></div><p className="text-xl font-bold text-[#0F1D2E]">${Math.round(demo.median_household_income / 1000)}k</p></div>}
        {demo.renter_occupied_pct !== null && <div><div className="flex items-center gap-1.5 mb-1"><Home className="w-3.5 h-3.5 text-[#F59E0B]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Renters</span></div><p className="text-xl font-bold text-[#0F1D2E]">{Math.round(demo.renter_occupied_pct)}%</p><div className="w-full h-1.5 bg-[#f1f5f9] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${demo.renter_occupied_pct}%` }} /></div></div>}
        {demo.median_age && <div><div className="flex items-center gap-1.5 mb-1"><Users className="w-3.5 h-3.5 text-[#7C3AED]" /><span className="text-xs text-[#94a3b8] uppercase tracking-wide font-medium">Median Age</span></div><p className="text-xl font-bold text-[#0F1D2E]">{demo.median_age}</p></div>}
      </div>
    </div>
  );
}

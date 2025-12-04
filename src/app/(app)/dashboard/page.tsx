import { KpiCard } from "@/components/dashboard/kpi-card";
import { OverviewChart } from "@/components/dashboard/overview-chart";
import { AiInsights } from "@/components/dashboard/ai-insights";
import { kpiData } from "@/lib/data";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <KpiCard key={kpi.title} data={kpi} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <OverviewChart />
        </div>
        <div className="lg:col-span-1">
            <AiInsights />
        </div>
      </div>
       {/* Future sections like Recent Activity and Summary Table would go here */}
    </div>
  );
}

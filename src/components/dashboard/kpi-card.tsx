import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/types";
import { Wallet, AlertTriangle, ArrowUp, TrendingUp, ArrowDown } from "lucide-react";

const icons = {
  Wallet: Wallet,
  AlertTriangle: AlertTriangle,
  ArrowUp: ArrowUp,
  TrendingUp: TrendingUp,
};

type KpiCardProps = {
  data: Kpi;
};

export function KpiCard({ data }: KpiCardProps) {
  const { title, value, icon, trend, trendDirection, subText, color, textColor } = data;
  const IconComponent = icons[icon as keyof typeof icons] || Wallet;

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("h-8 w-8 flex items-center justify-center rounded-lg", color)}>
          <IconComponent className={cn("h-4 w-4", textColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-code">{value}</div>
        <div className="flex items-center text-xs text-muted-foreground">
          {trend && (
            <span className={cn(
              "flex items-center gap-1",
              trendDirection === 'up' ? 'text-green-600' : 'text-red-600'
            )}>
              {trendDirection === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
              {trend}
            </span>
          )}
          {subText && <p className="ml-1">{subText}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

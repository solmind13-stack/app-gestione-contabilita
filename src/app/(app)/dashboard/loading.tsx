import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
       <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                     <div className="flex gap-4 w-full md:w-auto">
                        <Skeleton className="h-10 w-[180px]" />
                    </div>
                    <Skeleton className="h-10 w-[200px]" />
                </div>
            </CardContent>
        </Card>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <Skeleton className="h-[320px] w-full" />
        </div>
        <div className="lg:col-span-1">
            <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
       <div className="grid grid-cols-1 gap-6">
         <Skeleton className="h-96 w-full" />
      </div>
       <div className="grid grid-cols-1 gap-6">
         <Skeleton className="h-80 w-full" />
      </div>
    </div>
  );
}

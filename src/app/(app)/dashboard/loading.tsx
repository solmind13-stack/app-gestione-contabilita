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
       <Card>
        <CardHeader>
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
                <Skeleton className="h-20" />
                <Skeleton className="h-20" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
                <Skeleton className="h-40" />
                <Skeleton className="h-40" />
            </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-3">
            <Skeleton className="h-[320px] w-full" />
        </div>
      </div>
    </div>
  );
}

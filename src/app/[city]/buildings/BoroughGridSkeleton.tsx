import { Card, CardContent } from "@/components/ui/Card";
import { Building2, AlertTriangle, MessageSquare } from "lucide-react";

export function BoroughGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} hover>
          <CardContent className="p-6">
            <div className="h-7 w-32 bg-[#f1f5f9] rounded mb-4" />
            <div className="space-y-2 text-sm text-[#64748b]">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span className="inline-block h-4 w-24 bg-[#f1f5f9] rounded" />
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="inline-block h-4 w-28 bg-[#f1f5f9] rounded" />
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <span className="inline-block h-4 w-28 bg-[#f1f5f9] rounded" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

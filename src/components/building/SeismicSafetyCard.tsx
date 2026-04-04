import { ShieldAlert, ShieldCheck, Clock } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";

interface SeismicSafetyCardProps {
  isSoftStory: boolean;
  softStoryStatus: string | null;
}

export function SeismicSafetyCard({ isSoftStory, softStoryStatus }: SeismicSafetyCardProps) {
  if (!isSoftStory) return null;

  const isRetrofitted = softStoryStatus === "Retrofitted";
  const isInProgress = softStoryStatus === "In Progress";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {isRetrofitted ? (
            <ShieldCheck className="w-[18px] h-[18px] text-emerald-600" />
          ) : (
            <ShieldAlert className="w-[18px] h-[18px] text-amber-600" />
          )}
          <h3 className="font-semibold" style={{ color: T.text1 }}>Seismic Safety</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                isRetrofitted
                  ? "bg-emerald-50 text-emerald-700"
                  : isInProgress
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {isRetrofitted ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : isInProgress ? (
                <Clock className="w-3.5 h-3.5" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              {softStoryStatus || "Soft-Story Building"}
            </span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: T.text2 }}>
            {isRetrofitted
              ? "This building has been seismically retrofitted under LA's Soft-Story Retrofit Program. It has received a Certificate of Compliance."
              : isInProgress
              ? "This building is a pre-1978 soft-story structure currently undergoing seismic retrofit work."
              : "This building is identified as a pre-1978 soft-story structure that may be vulnerable to earthquake damage."}
          </p>
          <p className="text-[10px]" style={{ color: T.text3 }}>
            Source: LADBS Soft-Story Retrofit Program
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

import type { AnalyzeResponse } from "./types";
import { Shield, AlertTriangle, AlertCircle } from "lucide-react";

interface TenantRightsCalloutProps {
  result: AnalyzeResponse;
}

interface CalloutBox {
  color: "green" | "yellow" | "red";
  title: string;
  body: string;
}

export function TenantRightsCallout({ result }: TenantRightsCalloutProps) {
  const boxes: CalloutBox[] = [];

  if (result.stabilization?.is_stabilized) {
    boxes.push({
      color: "green",
      title: "Your Rights as a Rent-Stabilized Tenant",
      body: "Your landlord must offer you a lease renewal. Annual rent increases are capped by the NYC Rent Guidelines Board. Ask your landlord for the legal registered rent before signing. File a complaint at nyc.gov/hpd if your rights are violated.",
    });
  }

  if (result.violations?.classification === "above_average") {
    boxes.push({
      color: "yellow",
      title: "Building Has Above-Average Violations",
      body: "Consider requesting the full HPD inspection history before signing. You can look up this building at hpdinline.building.nyc.gov",
    });
  }

  if (result.litigations && result.litigations.active_litigations > 0) {
    boxes.push({
      color: "red",
      title: "This Building Has Active Legal Cases",
      body: "Review case details at the NYC OATH portal before signing your lease. Active cases may indicate ongoing habitability or management issues.",
    });
  }

  if (result.litigations?.has_harassment_case) {
    boxes.push({
      color: "red",
      title: "Tenant Harassment Case on Record",
      body: "This building has a history of alleged tenant harassment. Know your rights at metcouncilonhousing.org",
    });
  }

  if (
    result.stabilization?.yoy_unit_change_pct != null &&
    result.stabilization.yoy_unit_change_pct < -10
  ) {
    boxes.push({
      color: "yellow",
      title: "Stabilized Unit Count Is Declining",
      body: "This building has been losing rent-stabilized units. Make sure to confirm the legal status of your specific unit before signing.",
    });
  }

  if (boxes.length === 0) return null;

  const colorMap = {
    green: {
      bg: "bg-emerald-50",
      border: "border-l-emerald-500",
      icon: <Shield size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />,
      title: "text-emerald-800",
    },
    yellow: {
      bg: "bg-amber-50",
      border: "border-l-amber-500",
      icon: <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />,
      title: "text-amber-800",
    },
    red: {
      bg: "bg-red-50",
      border: "border-l-red-500",
      icon: <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />,
      title: "text-red-800",
    },
  };

  return (
    <div className="flex flex-col gap-3 mb-5">
      {boxes.map((box, i) => {
        const style = colorMap[box.color];
        return (
          <div
            key={i}
            className={`${style.bg} border-l-4 ${style.border} rounded-r-xl px-5 py-4 flex gap-3`}
          >
            {style.icon}
            <div>
              <p className={`text-sm font-semibold ${style.title} mb-1`}>{box.title}</p>
              <p className="text-[13px] text-gray-600 leading-relaxed">{box.body}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

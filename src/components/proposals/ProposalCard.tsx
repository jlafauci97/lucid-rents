import { ExternalLink, User, MapPin, Calendar } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";

export interface Proposal {
  id: number;
  metro: string;
  source: string;
  external_id: string;
  title: string;
  type: string;
  status: string;
  category: string;
  borough: string | null;
  council_district: number | null;
  neighborhood: string | null;
  sponsor: string | null;
  intro_date: string;
  last_action_date: string | null;
  hearing_date: string | null;
  description: string | null;
  source_url: string;
  latitude: number | null;
  longitude: number | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "nyc_council_bills": return "NYC Council";
    case "nyc_zap": return "NYC Planning";
    case "la_council_files": return "LA Council";
    case "la_zimas": return "LA Planning";
    default: return source;
  }
}

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const locationParts: string[] = [];
  if (proposal.borough) locationParts.push(proposal.borough);
  if (proposal.council_district) locationParts.push(`District ${proposal.council_district}`);
  if (proposal.neighborhood) locationParts.push(proposal.neighborhood);
  const location = locationParts.join(" \u00b7 ") || "Citywide";

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 hover:border-[#E2E8F0] transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <CategoryBadge category={proposal.category} />
        <StatusBadge status={proposal.status} />
        <span className="text-xs text-[#A3ACBE]">
          {proposal.type === "legislation" ? "Legislation" : "Land Use"}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-[#1A1F36] mb-1 line-clamp-2">
        {proposal.title}
      </h3>

      {proposal.description && (
        <p className="text-xs text-[#5E6687] mb-2 line-clamp-2">
          {proposal.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5E6687]">
        {proposal.sponsor && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {proposal.sponsor}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(proposal.intro_date)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {location}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f1f5f9]">
        <span className="text-xs text-[#A3ACBE]">{getSourceLabel(proposal.source)}</span>
        <a
          href={proposal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#3b82f6] hover:text-[#2563eb] font-medium"
        >
          View Source
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

import type { NeighborhoodVibe } from "@/lib/neighborhood-vibes";

interface VibeCheckProps {
  vibe: NeighborhoodVibe;
  neighborhoodName: string;
}

export function VibeCheck({ vibe, neighborhoodName }: VibeCheckProps) {
  return (
    <section className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6">
      <h2 className="text-lg font-bold text-[#1A1F36] mb-3">
        {neighborhoodName} Vibe Check
      </h2>

      <p className="text-sm text-[#5E6687] leading-relaxed mb-4">{vibe.description}</p>

      {/* Vibe tags */}
      <div className="flex flex-wrap gap-2 mb-5">
        {vibe.vibeTags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 text-xs font-medium bg-[#F5F7FA] text-[#5E6687] rounded-full border border-[#E2E8F0]"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Pros & Cons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-700 mb-2">Pros</h3>
          <ul className="space-y-1.5">
            {vibe.pros.map((pro) => (
              <li key={pro} className="flex items-start gap-2 text-sm text-[#5E6687]">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>
                {pro}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-2">Cons</h3>
          <ul className="space-y-1.5">
            {vibe.cons.map((con) => (
              <li key={con} className="flex items-start gap-2 text-sm text-[#5E6687]">
                <span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>
                {con}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

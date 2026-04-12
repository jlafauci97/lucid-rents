"use client";

import { useState } from "react";
import { STREETEASY_URL_REGEX } from "@/lib/fair-rent/constants";
import { Building2, Shield, Scale } from "lucide-react";

const AMENITY_OPTIONS = [
  { id: "doorman", label: "Doorman" },
  { id: "elevator", label: "Elevator" },
  { id: "private_outdoor_space", label: "Private outdoor space" },
  { id: "in_unit_laundry", label: "In-unit laundry" },
  { id: "gym", label: "Gym" },
  { id: "parking", label: "Parking" },
  { id: "pet_friendly", label: "Pet friendly" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "central_ac", label: "Central A/C" },
  { id: "roof_access", label: "Roof access" },
];

interface LandingHeroProps {
  onAnalyze: (url: string, amenities: string[]) => void;
}

export function LandingHero({ onAnalyze }: LandingHeroProps) {
  const [url, setUrl] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [showAmenities, setShowAmenities] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = () => {
    const testUrl = url.trim() || "https://streeteasy.com/building/142-east-12-street/4b";
    if (!STREETEASY_URL_REGEX.test(testUrl)) {
      setUrlError("Please paste a valid StreetEasy listing URL (e.g. streeteasy.com/rental/...)");
      return;
    }
    setUrlError(null);
    onAnalyze(testUrl, amenities);
  };

  const toggleAmenity = (id: string) => {
    setAmenities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[#0F1D2E] text-white flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(59,130,246,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-[11px] font-semibold tracking-[3px] uppercase text-white/40 mb-7">
          NYC Rental Intelligence
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
          Know Your Rent,
          <br />
          <span className="text-white/50 font-normal italic">Before You Sign</span>
        </h1>

        <p className="text-base text-white/40 leading-relaxed max-w-md mx-auto mb-10">
          Fair market pricing, building red flags, and negotiation leverage — all from one listing URL.
        </p>

        <div className="flex flex-col sm:flex-row gap-0 max-w-xl mx-auto bg-white/[0.08] border border-white/[0.12] rounded-2xl sm:rounded-full overflow-hidden backdrop-blur-sm">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Paste a StreetEasy listing URL..."
            className="flex-1 px-6 py-4 bg-transparent text-white text-[15px] outline-none placeholder:text-white/30"
          />
          <button
            onClick={handleSubmit}
            className="px-7 py-3 m-1.5 rounded-full bg-white text-[#0F1D2E] text-sm font-semibold hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Analyze
          </button>
        </div>

        {urlError && (
          <p className="mt-3 text-red-400 text-xs">{urlError}</p>
        )}

        <p className="mt-4 text-xs text-white/25">
          No link?{" "}
          <button
            onClick={() => {
              setUrl("https://streeteasy.com/building/142-east-12-street/4b");
            }}
            className="text-white/50 hover:text-white transition-colors underline cursor-pointer"
          >
            Try a sample listing
          </button>
        </p>

        <button
          onClick={() => setShowAmenities(!showAmenities)}
          className="mt-6 text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
        >
          {showAmenities ? "Hide" : "Add"} amenity filters
        </button>

        {showAmenities && (
          <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {AMENITY_OPTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => toggleAmenity(a.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                  amenities.includes(a.id)
                    ? "bg-white/20 border-white/40 text-white"
                    : "bg-transparent border-white/10 text-white/40 hover:border-white/25"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-center gap-12 mt-16 pt-10 border-t border-white/[0.08]">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Building2 size={14} className="text-white/30" />
              <span className="text-2xl font-bold">7</span>
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Data Sources</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield size={14} className="text-white/30" />
              <span className="text-2xl font-bold">100%</span>
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Public Data</span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Scale size={14} className="text-white/30" />
              <span className="text-2xl font-bold">Free</span>
            </div>
            <span className="text-[10px] text-white/35 uppercase tracking-wider">Always</span>
          </div>
        </div>
      </div>
    </div>
  );
}

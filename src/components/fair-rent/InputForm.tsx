"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Zap, Shield, BarChart3 } from "lucide-react";

const AMENITY_OPTIONS = [
  { id: "doorman", label: "Doorman" },
  { id: "elevator", label: "Elevator" },
  { id: "private_outdoor_space", label: "Outdoor Space" },
  { id: "in_unit_laundry", label: "In-Unit Laundry" },
  { id: "gym", label: "Gym" },
  { id: "parking", label: "Parking" },
  { id: "pet_friendly", label: "Pet Friendly" },
  { id: "dishwasher", label: "Dishwasher" },
  { id: "central_ac", label: "Central A/C" },
  { id: "roof_access", label: "Roof Access" },
];

interface InputFormProps {
  onAnalyze: (data: { address: string; asking_price: number; beds: number; sqft: number | null; zip_code: string; amenities: string[] }) => void;
  error: string | null;
}

export function InputForm({ onAnalyze, error }: InputFormProps) {
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState("");
  const [zip, setZip] = useState("");
  const [beds, setBeds] = useState("");
  const [sqft, setSqft] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const toggleAmenity = (id: string) =>
    setAmenities((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const askingPrice = parseInt(price.replace(/[^0-9]/g, ""), 10);
    const bedCount = parseInt(beds, 10);
    const zipCode = zip.trim();

    if (!address.trim()) { setValidationError("Enter the building address"); return; }
    if (!askingPrice || askingPrice < 500) { setValidationError("Enter a valid monthly rent"); return; }
    if (!/^\d{5}$/.test(zipCode)) { setValidationError("Enter a valid 5-digit ZIP"); return; }
    if (isNaN(bedCount) || bedCount < 0) { setValidationError("Enter bedroom count (0 = studio)"); return; }

    setValidationError(null);
    onAnalyze({
      address: address.trim(),
      asking_price: askingPrice,
      beds: bedCount,
      sqft: sqft ? parseInt(sqft.replace(/[^0-9]/g, ""), 10) : null,
      zip_code: zipCode,
      amenities,
    });
  };

  return (
    <div className="min-h-screen bg-[#0a0e17] relative overflow-hidden flex items-center justify-center px-4">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Glow orb */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#00D4FF]/[0.04] rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        className="relative z-10 w-full max-w-xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Cpu size={20} className="text-[#00D4FF]" />
            <span className="text-[10px] font-mono font-bold tracking-[4px] uppercase text-[#00D4FF]/70">
              Fair Rent Engine
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            Analyze Any NYC Listing
          </h1>
          <p className="text-sm text-white/30 max-w-md mx-auto">
            Enter listing details to get fair market pricing, building intelligence, and negotiation leverage.
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 sm:p-8 backdrop-blur-sm">
          {/* Address */}
          <label className="block mb-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D4FF]/60 mb-1.5 block">Building Address</span>
            <input
              type="text"
              placeholder="e.g. 122 West 97 Street"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm font-mono outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40 focus:shadow-[0_0_20px_rgba(0,212,255,0.08)] transition-all"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D4FF]/60 mb-1.5 block">Monthly Rent</span>
              <input
                type="text"
                placeholder="$3,500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm font-mono outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40 focus:shadow-[0_0_20px_rgba(0,212,255,0.08)] transition-all"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D4FF]/60 mb-1.5 block">ZIP Code</span>
              <input
                type="text"
                placeholder="10025"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm font-mono outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40 focus:shadow-[0_0_20px_rgba(0,212,255,0.08)] transition-all"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D4FF]/60 mb-1.5 block">Bedrooms</span>
              <input
                type="text"
                placeholder="0 = studio"
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm font-mono outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40 focus:shadow-[0_0_20px_rgba(0,212,255,0.08)] transition-all"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D4FF]/60 mb-1.5 block">Sqft (optional)</span>
              <input
                type="text"
                placeholder="—"
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white text-sm font-mono outline-none placeholder:text-white/20 focus:border-[#00D4FF]/40 focus:shadow-[0_0_20px_rgba(0,212,255,0.08)] transition-all"
              />
            </label>
          </div>

          {/* Amenities */}
          <div className="mb-6">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#00D4FF]/60 mb-2 block">Amenities</span>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAmenity(a.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                    amenities.includes(a.id)
                      ? "bg-[#00D4FF]/15 border-[#00D4FF]/40 text-[#00D4FF] shadow-[0_0_12px_rgba(0,212,255,0.15)]"
                      : "bg-white/[0.03] border-white/[0.08] text-white/30 hover:border-white/20"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {(validationError || error) && (
            <p className="text-red-400 text-xs font-mono mb-4">{validationError || error}</p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-[#00D4FF] hover:bg-[#00bde0] text-[#0a0e17] font-bold text-sm rounded-xl transition-all cursor-pointer shadow-[0_0_30px_rgba(0,212,255,0.2)] hover:shadow-[0_0_40px_rgba(0,212,255,0.3)]"
          >
            Run Analysis
          </button>
        </form>

        {/* Stats */}
        <div className="flex justify-center gap-8 mt-8 text-center">
          {[
            { icon: BarChart3, val: "7", label: "Data Sources" },
            { icon: Shield, val: "100%", label: "Public Data" },
            { icon: Zap, val: "Real-time", label: "NYC Open Data" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <s.icon size={14} className="text-[#00D4FF]/40" />
              <span className="text-sm font-bold font-mono text-white/70">{s.val}</span>
              <span className="text-[9px] uppercase tracking-wider text-white/20">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

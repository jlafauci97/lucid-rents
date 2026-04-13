"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Cpu, Zap, Shield, BarChart3, X } from "lucide-react";

interface SearchResult {
  id: string;
  full_address: string;
  borough: string;
  zip_code: string;
  slug: string;
  overall_score: string | null;
  violation_count: number;
}

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
  onAnalyze: (data: {
    building_id?: string;
    address: string;
    asking_price: number;
    beds: number;
    sqft: number | null;
    zip_code: string;
    amenities: string[];
  }) => void;
  error: string | null;
}

export function InputForm({ onAnalyze, error }: InputFormProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<SearchResult | null>(null);
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [sqft, setSqft] = useState("");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (query.length < 3 || selectedBuilding) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/fair-rent/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.buildings || []);
        setShowDropdown(true);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, selectedBuilding]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectBuilding = (building: SearchResult) => {
    setSelectedBuilding(building);
    setQuery(building.full_address);
    setShowDropdown(false);
  };

  const clearSelection = () => {
    setSelectedBuilding(null);
    setQuery("");
  };

  const toggleAmenity = (id: string) =>
    setAmenities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) { setValidationError("Search and select a building first"); return; }
    const askingPrice = parseInt(price.replace(/[^0-9]/g, ""), 10);
    const bedCount = parseInt(beds, 10);
    if (!askingPrice || askingPrice < 500) { setValidationError("Enter the monthly rent you're being asked to pay"); return; }
    if (isNaN(bedCount) || bedCount < 0) { setValidationError("Enter bedroom count (0 = studio)"); return; }
    setValidationError(null);
    onAnalyze({
      building_id: selectedBuilding.id,
      address: selectedBuilding.full_address,
      asking_price: askingPrice,
      beds: bedCount,
      sqft: sqft ? parseInt(sqft.replace(/[^0-9]/g, ""), 10) : null,
      zip_code: selectedBuilding.zip_code,
      amenities,
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Cpu size={20} className="text-blue-600" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-blue-600/70">Fair Rent Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">Is Your Rent Fair?</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">Search any NYC building. We analyze violations, complaints, crime, and market data to determine what the rent should actually be.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="relative mb-5" ref={dropdownRef}>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Building Address</span>
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                <input type="text" placeholder="Search any NYC building..." value={query}
                  onChange={(e) => { setQuery(e.target.value); if (selectedBuilding) setSelectedBuilding(null); }}
                  className={`w-full pl-11 pr-10 py-3 rounded-xl border text-sm outline-none transition-all ${
                    selectedBuilding ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  }`} />
                {selectedBuilding && (
                  <button type="button" onClick={clearSelection} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600 cursor-pointer"><X size={16} /></button>
                )}
                {searching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>}
              </div>
            </label>

            {showDropdown && results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-64 overflow-y-auto">
                {results.map((r) => (
                  <button key={r.id} type="button" onClick={() => selectBuilding(r)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.full_address}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                      <span>{r.borough}</span><span>{r.zip_code}</span>
                      {r.violation_count > 0 && <span className="text-amber-500">{r.violation_count} violations</span>}
                      {r.overall_score && <span className="text-blue-500">Score: {r.overall_score}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && results.length === 0 && query.length >= 3 && !searching && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 px-4 py-3">
                <p className="text-sm text-gray-400">No buildings found</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Asking Rent</span>
              <input type="text" placeholder="$3,500" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Bedrooms</span>
              <input type="text" placeholder="0 = studio" value={beds} onChange={(e) => setBeds(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Sqft (opt.)</span>
              <input type="text" placeholder="—" value={sqft} onChange={(e) => setSqft(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </label>
          </div>

          <div className="mb-6">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2 block">Amenities</span>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <button key={a.id} type="button" onClick={() => toggleAmenity(a.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                    amenities.includes(a.id) ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}>{a.label}</button>
              ))}
            </div>
          </div>

          {(validationError || error) && <p className="text-red-500 text-xs mb-4">{validationError || error}</p>}
          <button type="submit" className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all cursor-pointer shadow-sm">Run Analysis</button>
        </form>

        <div className="flex justify-center gap-8 mt-8 text-center">
          {[{ icon: BarChart3, val: "7", label: "Data Sources" }, { icon: Shield, val: "100%", label: "Public Data" }, { icon: Zap, val: "Real-time", label: "NYC Open Data" }].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1">
              <s.icon size={14} className="text-blue-400" />
              <span className="text-sm font-bold text-gray-700">{s.val}</span>
              <span className="text-[9px] uppercase tracking-wider text-gray-400">{s.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

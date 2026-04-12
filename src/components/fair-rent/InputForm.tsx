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
    onAnalyze({ address: address.trim(), asking_price: askingPrice, beds: bedCount, sqft: sqft ? parseInt(sqft.replace(/[^0-9]/g, ""), 10) : null, zip_code: zipCode, amenities });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <motion.div className="w-full max-w-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Cpu size={20} className="text-blue-600" />
            <span className="text-xs font-semibold tracking-[3px] uppercase text-blue-600/70">Fair Rent Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-3">Analyze Any NYC Listing</h1>
          <p className="text-sm text-gray-500 max-w-md mx-auto">Enter listing details to get fair market pricing, building intelligence, and negotiation leverage.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <label className="block mb-4">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Building Address</span>
            <input type="text" placeholder="e.g. 122 West 97 Street" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
          </label>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Monthly Rent</span>
              <input type="text" placeholder="$3,500" value={price} onChange={(e) => setPrice(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">ZIP Code</span>
              <input type="text" placeholder="10025" value={zip} onChange={(e) => setZip(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Bedrooms</span>
              <input type="text" placeholder="0 = studio" value={beds} onChange={(e) => setBeds(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-900 text-sm outline-none placeholder:text-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all" />
            </label>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 block">Sqft (optional)</span>
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
          {[
            { icon: BarChart3, val: "7", label: "Data Sources" },
            { icon: Shield, val: "100%", label: "Public Data" },
            { icon: Zap, val: "Real-time", label: "NYC Open Data" },
          ].map((s) => (
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

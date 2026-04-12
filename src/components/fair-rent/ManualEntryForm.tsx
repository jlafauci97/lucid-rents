"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export interface ManualEntry {
  asking_price: number;
  beds: number;
  sqft: number | null;
  zip_code: string;
  address: string;
}

interface ManualEntryFormProps {
  errorMessage: string | null;
  onSubmit: (entry: ManualEntry) => void;
  onBack: () => void;
}

export function ManualEntryForm({ errorMessage, onSubmit, onBack }: ManualEntryFormProps) {
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [sqft, setSqft] = useState("");
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const askingPrice = parseInt(price.replace(/[^0-9]/g, ""), 10);
    const bedCount = parseInt(beds, 10);
    const zipCode = zip.trim();

    if (!askingPrice || askingPrice < 500) {
      setValidationError("Enter a valid monthly rent amount");
      return;
    }
    if (isNaN(bedCount) || bedCount < 0) {
      setValidationError("Enter the number of bedrooms (0 for studio)");
      return;
    }
    if (!/^\d{5}$/.test(zipCode)) {
      setValidationError("Enter a valid 5-digit NYC ZIP code");
      return;
    }
    if (!address.trim()) {
      setValidationError("Enter the building address");
      return;
    }

    setValidationError(null);
    onSubmit({
      asking_price: askingPrice,
      beds: bedCount,
      sqft: sqft ? parseInt(sqft.replace(/[^0-9]/g, ""), 10) : null,
      zip_code: zipCode,
      address: address.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-[#0F1D2E] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-8 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back
        </button>

        <p className="text-white text-lg font-semibold mb-2">Enter listing details</p>
        <p className="text-white/40 text-sm mb-8">
          {errorMessage || "We couldn't read the listing automatically. Enter the key details to continue."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Building address (e.g. 142 E 12th Street)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Monthly rent ($)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <input
              type="text"
              placeholder="ZIP code"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Bedrooms (0 = studio)"
              value={beds}
              onChange={(e) => setBeds(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
            <input
              type="text"
              placeholder="Sqft (optional)"
              value={sqft}
              onChange={(e) => setSqft(e.target.value)}
              className="px-4 py-3 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white text-sm outline-none placeholder:text-white/30 focus:border-white/30"
            />
          </div>

          {validationError && (
            <p className="text-red-400 text-xs">{validationError}</p>
          )}

          <button
            type="submit"
            className="mt-2 px-6 py-3 bg-white text-[#0F1D2E] rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Analyze with these details
          </button>
        </form>
      </div>
    </div>
  );
}

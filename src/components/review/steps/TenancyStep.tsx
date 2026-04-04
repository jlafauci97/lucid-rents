"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PillToggle } from "@/components/ui/PillToggle";
import { LEASE_TYPES_BY_CITY } from "@/lib/constants";
import type { City } from "@/lib/cities";

interface TenancyStepProps {
  isCurrentResident: boolean;
  moveInDate: string;
  onMoveInDateChange: (value: string) => void;
  moveOutDate: string;
  onMoveOutDateChange: (value: string) => void;
  leaseType: string;
  onLeaseTypeChange: (value: string) => void;
  rentAmount: string;
  onRentAmountChange: (value: string) => void;
  landlordName: string;
  onLandlordNameChange: (value: string) => void;
  wouldRecommend: boolean | null;
  onWouldRecommendChange: (value: boolean) => void;
  isPetFriendly: boolean | null;
  onIsPetFriendlyChange: (value: boolean) => void;
  city: string;
}

export function TenancyStep({
  isCurrentResident,
  moveInDate,
  onMoveInDateChange,
  moveOutDate,
  onMoveOutDateChange,
  leaseType,
  onLeaseTypeChange,
  rentAmount,
  onRentAmountChange,
  landlordName,
  onLandlordNameChange,
  wouldRecommend,
  onWouldRecommendChange,
  isPetFriendly,
  onIsPetFriendlyChange,
  city,
}: TenancyStepProps) {
  const leaseTypes = LEASE_TYPES_BY_CITY[city as City] || LEASE_TYPES_BY_CITY["nyc"];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#0F1D2E]">Tenancy Details</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Move-in Date *"
          type="date"
          value={moveInDate}
          onChange={(e) => onMoveInDateChange(e.target.value)}
          required
        />
        {!isCurrentResident && (
          <Input
            label="Move-out Date *"
            type="date"
            value={moveOutDate}
            onChange={(e) => onMoveOutDateChange(e.target.value)}
            required
          />
        )}
      </div>

      <Select
        label="Lease Type"
        value={leaseType}
        onChange={(e) => onLeaseTypeChange(e.target.value)}
        options={leaseTypes.map((lt) => ({
          value: lt.value,
          label: lt.label,
        }))}
        placeholder="Select lease type..."
      />

      <div className="space-y-1">
        <label
          htmlFor="rent-amount"
          className="block text-sm font-medium text-[#0F1D2E]"
        >
          Monthly Rent <span className="text-[#ef4444]">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8]">
            $
          </span>
          <input
            id="rent-amount"
            type="number"
            value={rentAmount}
            onChange={(e) => onRentAmountChange(e.target.value)}
            placeholder="e.g., 2500"
            min="0"
            className="w-full pl-7 pr-3 py-2 rounded-lg border border-[#e2e8f0] bg-white text-sm text-[#0F1D2E] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            required
          />
        </div>
      </div>

      <Input
        label="Landlord / Management Company"
        value={landlordName}
        onChange={(e) => onLandlordNameChange(e.target.value)}
        placeholder="e.g., Equity Residential"
      />

      <PillToggle
        label="Would you recommend this building?"
        value={wouldRecommend}
        onChange={onWouldRecommendChange}
        required
      />

      <PillToggle
        label="Is this building pet friendly?"
        value={isPetFriendly}
        onChange={onIsPetFriendlyChange}
      />
    </div>
  );
}

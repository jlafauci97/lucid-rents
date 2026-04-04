"use client";

interface PillToggleProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  options?: { label: string; value: boolean }[];
  required?: boolean;
}

const defaultOptions = [
  { label: "Yes", value: true },
  { label: "No", value: false },
];

export function PillToggle({
  label,
  value,
  onChange,
  options = defaultOptions,
  required,
}: PillToggleProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#0F1D2E]">
        {label}
        {required && <span className="text-[#ef4444] ml-0.5">*</span>}
      </label>
      <div className="flex gap-2">
        {options.map((option) => {
          const isActive = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                  : "border-[#e2e8f0] text-[#64748b] hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

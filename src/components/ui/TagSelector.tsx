"use client";

interface TagSelectorProps {
  label: string;
  tags: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accentColor: "green" | "red";
  required?: boolean;
}

const activeStyles = {
  green: "bg-[#10b981]/10 text-[#10b981] border-[#10b981]",
  red: "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]",
};

export function TagSelector({
  label,
  tags,
  selected,
  onChange,
  accentColor,
  required,
}: TagSelectorProps) {
  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#1A1F36]">
        {label}
        {selected.length > 0 && (
          <span className="ml-1.5 text-[#A3ACBE] font-normal">
            ({selected.length} selected)
          </span>
        )}
        {required && <span className="text-[#ef4444] ml-0.5">*</span>}
      </label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isActive = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                isActive
                  ? activeStyles[accentColor]
                  : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

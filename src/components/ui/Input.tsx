import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#0F1D2E]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0F1D2E] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${error ? "border-[#ef4444] focus:ring-[#ef4444]" : ""} ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-[#ef4444]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

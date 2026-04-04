"use client";

import { useState, useCallback } from "react";
import { Copy, Printer, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { TemplateData, TemplateField } from "@/lib/tenant-templates-data";

interface TemplateViewerProps {
  template: TemplateData;
  cityAgencyName: string;
  cityName: string;
}

function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `[${key}]`);
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
}) {
  const baseClass =
    "w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1A1F36] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent transition";

  if (field.type === "textarea") {
    return (
      <textarea
        id={field.id}
        rows={4}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={`${baseClass} resize-y`}
      />
    );
  }

  if (field.type === "date") {
    return (
      <input
        type="date"
        id={field.id}
        value={value}
        onChange={(e) => {
          // Format to readable date string in preview
          if (e.target.value) {
            const d = new Date(e.target.value + "T00:00:00");
            const formatted = d.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            onChange(formatted);
          } else {
            onChange(e.target.value);
          }
        }}
        className={baseClass}
      />
    );
  }

  return (
    <input
      type="text"
      id={field.id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={baseClass}
    />
  );
}

export function TemplateViewer({ template, cityAgencyName, cityName }: TemplateViewerProps) {
  const initialValues = Object.fromEntries(template.fields.map((f) => [f.id, ""]));
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const filledBody = fillTemplate(template.body, values);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(filledBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [filledBody]);

  const handlePrint = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${template.title}</title>
          <style>
            body { font-family: Georgia, serif; max-width: 680px; margin: 60px auto; padding: 0 24px; color: #111; line-height: 1.7; font-size: 14px; }
            pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.7; }
            @media print { body { margin: 40px; } }
          </style>
        </head>
        <body><pre>${filledBody}</pre></body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }, [filledBody, template.title]);

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* Left: Form */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#1A1F36] mb-1">Fill in Your Details</h2>
        <p className="text-sm text-gray-500 mb-6">
          Fields update the letter preview in real-time. All information stays in your browser.
        </p>
        <div className="space-y-4">
          {template.fields.map((field) => (
            <div key={field.id}>
              <label
                htmlFor={field.id}
                className="block text-xs font-semibold text-[#1A1F36] mb-1.5 uppercase tracking-wide"
              >
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput
                field={field}
                value={values[field.id] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.id]: v }))}
              />
            </div>
          ))}
        </div>

        {/* Agency note */}
        <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-700">
          <span className="font-semibold">{cityName} housing agency:</span> {cityAgencyName}. After sending this letter, you may also file a complaint directly with {cityAgencyName}.
        </div>
      </div>

      {/* Right: Live Preview */}
      <div className="space-y-4">
        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#6366F1] hover:bg-[#2563EB] text-white text-sm font-semibold transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied!" : "Copy Letter"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-[#E2E8F0] hover:border-[#E2E8F0] text-[#1A1F36] text-sm font-semibold transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>

        {/* Mobile toggle for preview */}
        <button
          className="lg:hidden w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E2E8F0] bg-white text-sm font-semibold text-[#1A1F36]"
          onClick={() => setShowPreview((v) => !v)}
        >
          Letter Preview
          {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Letter preview paper */}
        <div className={`${showPreview ? "block" : "hidden"} lg:block`}>
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            {/* Paper header bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-[#E2E8F0] flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-gray-400 font-medium">{template.title}</span>
            </div>
            <div className="p-6 md:p-8">
              <pre
                className="whitespace-pre-wrap font-serif text-sm text-[#1a1a1a] leading-relaxed"
                style={{ fontFamily: "Georgia, Cambria, serif" }}
              >
                {filledBody}
              </pre>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 text-center">
          This letter is a template for informational purposes. Consider consulting with a tenant rights attorney for your specific situation.
        </p>
      </div>
    </div>
  );
}

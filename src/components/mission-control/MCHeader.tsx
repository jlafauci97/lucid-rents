export function MCHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-slate-800 bg-[#0F1D2E] px-8 py-5">
      <h1 className="text-xl font-bold text-slate-50">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
    </header>
  );
}

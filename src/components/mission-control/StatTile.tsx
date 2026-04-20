export interface StatTileProps {
  value: number | string;
  label: string;
}

export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#0F1D2E] p-4">
      <div className="text-2xl font-bold text-slate-50">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
        {label}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { BOROUGH_SLUGS } from '@/lib/seo';

interface Violation {
  id: string;
  violationClass: string;
  description: string;
  date: string;
  address: string;
  borough: string;
  slug: string | null;
  boroughSlug: string;
}

const classColors: Record<string, string> = {
  C: 'bg-red-500',
  B: 'bg-orange-400',
  A: 'bg-yellow-400',
  I: 'bg-blue-400',
};

const classLabels: Record<string, string> = {
  C: 'Immediately Hazardous',
  B: 'Hazardous',
  A: 'Non-Hazardous',
  I: 'Info',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildUrl(v: Violation): string | null {
  if (!v.slug) return null;
  const boroughSlug = BOROUGH_SLUGS[v.boroughSlug] || v.boroughSlug.toLowerCase().replace(/\s+/g, '-');
  return `/building/${boroughSlug}/${v.slug}`;
}

function TickerItem({ v }: { v: Violation }) {
  const url = buildUrl(v);
  const content = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${classColors[v.violationClass] || 'bg-gray-400'}`}
        title={classLabels[v.violationClass] || v.violationClass}
      />
      <span className="font-medium text-white/90">
        {v.address}{v.borough ? `, ${v.borough}` : ''}
      </span>
      <span className="text-white/50 mx-1">&mdash;</span>
      <span className="text-white/70">{v.description}</span>
      <span className="text-white/40 text-xs">{formatDate(v.date)}</span>
    </span>
  );

  if (url) {
    return (
      <Link href={url} className="hover:text-blue-300 transition-colors">
        {content}
      </Link>
    );
  }
  return content;
}

export function ViolationTicker() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/violations/recent')
      .then((res) => res.json())
      .then((data) => {
        if (data.violations) setViolations(data.violations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900 border-y border-slate-700/50 py-3 overflow-hidden">
        <div className="flex items-center gap-3 px-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400 uppercase tracking-wider flex-shrink-0">
            <AlertTriangle className="w-3.5 h-3.5" />
            Live
          </span>
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 bg-slate-700/50 rounded animate-pulse" style={{ width: `${200 + i * 40}px` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (violations.length === 0) return null;

  return (
    <div className="bg-slate-900 border-y border-slate-700/50 py-3 overflow-hidden group">
      <div className="flex items-center">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 uppercase tracking-wider flex-shrink-0 pl-4 pr-4 z-10 bg-slate-900">
          <AlertTriangle className="w-3.5 h-3.5" />
          Live
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex gap-8 text-sm ticker-scroll group-hover:[animation-play-state:paused]">
            {violations.map((v) => (
              <TickerItem key={`a-${v.id}`} v={v} />
            ))}
            {violations.map((v) => (
              <TickerItem key={`b-${v.id}`} v={v} />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ticker-scroll {
          animation: ticker 120s linear infinite;
          width: max-content;
        }
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

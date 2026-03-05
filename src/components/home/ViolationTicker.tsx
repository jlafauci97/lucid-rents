'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Shield, MessageSquare, Star, Scale, HardHat, Siren } from 'lucide-react';
import { BOROUGH_SLUGS } from '@/lib/seo';
import type { ActivityItem } from '@/app/api/activity/route';

/** Icon color on the blue ticker background — lighter variants for readability */
const typeIconColors: Record<ActivityItem['type'], string> = {
  violation: 'text-red-200',
  complaint: 'text-amber-200',
  review: 'text-white',
  litigation: 'text-purple-200',
  dob_violation: 'text-sky-200',
  crime: 'text-red-300',
};

function TypeIcon({ type }: { type: ActivityItem['type'] }) {
  const color = typeIconColors[type] || 'text-white/70';
  const cls = `w-5 h-5 flex-shrink-0 ${color}`;

  switch (type) {
    case 'violation':
      return <Shield className={cls} />;
    case 'complaint':
      return <MessageSquare className={cls} />;
    case 'review':
      return <Star className={cls} />;
    case 'litigation':
      return <Scale className={cls} />;
    case 'dob_violation':
      return <HardHat className={cls} />;
    case 'crime':
      return <Siren className={cls} />;
  }
}

const typeLabels: Record<ActivityItem['type'], string> = {
  violation: 'HPD Violation',
  complaint: 'Complaint',
  review: 'Review',
  litigation: 'Litigation',
  dob_violation: 'DOB Violation',
  crime: 'Crime',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildItemUrl(item: ActivityItem): string | null {
  if (item.type === 'crime' && item.zipCode) {
    return `/crime/${item.zipCode}`;
  }
  if (item.buildingSlug && item.borough) {
    const boroughSlug = BOROUGH_SLUGS[item.borough] || item.borough.toLowerCase().replace(/\s+/g, '-');
    return `/building/${boroughSlug}/${item.buildingSlug}`;
  }
  if (item.buildingId) {
    return `/building/${item.buildingId}`;
  }
  return null;
}

function TickerItem({ item }: { item: ActivityItem }) {
  const url = buildItemUrl(item);
  const content = (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <TypeIcon type={item.type} />
      <span className="text-white/50 text-xs font-medium uppercase tracking-wide">
        {typeLabels[item.type]}
      </span>
      <span className="font-medium text-white/90">
        {item.buildingAddress}{item.borough ? `, ${item.borough}` : ''}
      </span>
      <span className="text-white/50 mx-1">&mdash;</span>
      <span className="text-white/70">{item.description}</span>
      <span className="text-white/40 text-xs">{formatDate(item.date)}</span>
    </span>
  );

  if (url) {
    return (
      <Link href={url} className="hover:text-white/80 transition-colors">
        {content}
      </Link>
    );
  }
  return content;
}

export function ViolationTicker() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activity?limit=30')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-[#3B82F6] border-y border-blue-400/30 py-3 overflow-hidden">
        <div className="flex items-center gap-3 px-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wider flex-shrink-0">
            <AlertTriangle className="w-4 h-4" />
            Live
          </span>
          <div className="flex gap-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 bg-white/20 rounded animate-pulse" style={{ width: `${200 + i * 40}px` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  // Scale animation duration by item count for consistent speed
  const duration = items.length * 18;

  return (
    <div className="bg-[#3B82F6] border-y border-blue-400/30 py-3 overflow-hidden group/ticker">
      <div className="flex items-center">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-white uppercase tracking-wider flex-shrink-0 pl-4 pr-4 z-10 bg-[#3B82F6]">
          <AlertTriangle className="w-4 h-4" />
          Live
        </div>
        <div className="overflow-hidden flex-1">
          <div
            className="flex gap-8 text-sm text-white group-hover/ticker:[animation-play-state:paused]"
            style={{
              animation: `ticker ${duration}s linear infinite`,
              width: 'max-content',
            }}
          >
            {items.map((item) => (
              <TickerItem key={`a-${item.type}-${item.id}`} item={item} />
            ))}
            {items.map((item) => (
              <TickerItem key={`b-${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

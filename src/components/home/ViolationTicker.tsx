'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Shield,
  MessageSquare,
  Star,
  Gavel,
  HardHat,
  Siren,
  Bug,
  DoorOpen,
  DollarSign,
  FileCheck,
  ShieldAlert,
  OctagonAlert,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { buildingUrl, cityPath } from '@/lib/seo';
import { isValidCity, DEFAULT_CITY, type City } from '@/lib/cities';
import type { ActivityItem } from '@/app/api/activity/route';

/**
 * Each event type renders as a saturated color chip with a white icon
 * on top — gives the ticker visible weight against the blue background
 * and makes event types instantly distinguishable.
 */
const typeStyles: Record<ActivityItem['type'], { bg: string; Icon: LucideIcon }> = {
  violation:      { bg: 'bg-red-600',     Icon: Shield },
  complaint:      { bg: 'bg-amber-500',   Icon: MessageSquare },
  review:         { bg: 'bg-yellow-500',  Icon: Star },
  litigation:     { bg: 'bg-purple-600',  Icon: Gavel },
  dob_violation:  { bg: 'bg-sky-500',     Icon: HardHat },
  crime:          { bg: 'bg-red-700',     Icon: Siren },
  bedbug:         { bg: 'bg-purple-700',  Icon: Bug },
  eviction:       { bg: 'bg-pink-600',    Icon: DoorOpen },
  la_eviction:    { bg: 'bg-pink-600',    Icon: DoorOpen },
  tenant_buyout:  { bg: 'bg-orange-500',  Icon: DollarSign },
  permit:         { bg: 'bg-teal-500',    Icon: FileCheck },
  enforcement:    { bg: 'bg-indigo-600',  Icon: ShieldAlert },
  rlto_violation: { bg: 'bg-orange-600',  Icon: OctagonAlert },
  lead_inspection:{ bg: 'bg-lime-600',    Icon: FlaskConical },
};

function TypeIcon({ type }: { type: ActivityItem['type'] }) {
  const style = typeStyles[type] ?? { bg: 'bg-white/30', Icon: AlertTriangle };
  const Icon = style.Icon;
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ring-1 ring-white/25 shadow-sm ${style.bg}`}
    >
      <Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
    </span>
  );
}

const typeLabels: Record<ActivityItem['type'], string> = {
  violation: 'HPD Violation',
  complaint: 'Complaint',
  review: 'Review',
  litigation: 'Litigation',
  dob_violation: 'DOB Violation',
  crime: 'Crime',
  bedbug: 'Bedbug Report',
  eviction: 'Eviction',
  la_eviction: 'LAHD Eviction',
  tenant_buyout: 'Tenant Buyout',
  permit: 'Building Permit',
  enforcement: 'Enforcement',
  rlto_violation: 'RLTO Violation',
  lead_inspection: 'Lead Inspection',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildItemUrl(item: ActivityItem): string | null {
  const city: City = item.metro && isValidCity(item.metro) ? item.metro : DEFAULT_CITY;
  if (item.type === 'crime' && item.zipCode) {
    return cityPath(`/crime/${item.zipCode}`, city);
  }
  if (item.buildingSlug && item.borough) {
    return buildingUrl({ borough: item.borough, slug: item.buildingSlug }, city);
  }
  if (item.buildingId) {
    return cityPath(`/building/${item.buildingId}`, city);
  }
  return null;
}

function TickerItem({ item }: { item: ActivityItem }) {
  const url = buildItemUrl(item);
  const content = (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <TypeIcon type={item.type} />
      <span className="text-white/55 text-[10px] font-semibold uppercase tracking-wide">
        {typeLabels[item.type]}
      </span>
      <span className="font-medium text-white/90">
        {item.buildingAddress}{item.borough ? `, ${item.borough}` : ''}
      </span>
      <span className="text-white/45 mx-0.5">&mdash;</span>
      <span className="text-white/70">{item.description}</span>
      <span className="text-white/40 text-[10px]">{formatDate(item.date)}</span>
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

interface ViolationTickerProps {
  metro?: string;
  initialItems?: ActivityItem[];
}

export function ViolationTicker({ metro, initialItems }: ViolationTickerProps = {}) {
  const [items, setItems] = useState<ActivityItem[]>(initialItems || []);
  const [loading, setLoading] = useState(!initialItems || initialItems.length === 0);

  useEffect(() => {
    if (initialItems && initialItems.length > 0) return;

    const params = new URLSearchParams({ limit: "30" });
    if (metro) params.set("city", metro);
    fetch(`/api/activity?${params}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.items && data.items.length > 0) {
          setItems(data.items);
        } else if (metro) {
          return fetch(`/api/activity?limit=30`)
            .then((res) => res.json())
            .then((data) => {
              if (data.items) setItems(data.items);
            });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [metro, initialItems]);

  if (loading) {
    return (
      <div className="bg-[#3B82F6] border-y border-blue-400/30 py-2.5 overflow-hidden">
        <div className="flex items-center gap-2.5 px-4">
          <span className="flex items-center gap-1 text-[10px] font-bold text-white uppercase tracking-wider flex-shrink-0 bg-red-600 px-2 py-0.5 rounded">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
            Live
          </span>
          <div className="flex gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-3 bg-white/20 rounded animate-pulse" style={{ width: `${160 + i * 32}px` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const duration = items.length * 18;

  return (
    <div className="bg-[#3B82F6] border-y border-blue-400/30 py-2.5 overflow-hidden group/ticker">
      <div className="flex items-center">
        <div className="flex items-center flex-shrink-0 pl-3 pr-3 z-10 bg-[#3B82F6]">
          <span className="flex items-center gap-1 text-[10px] font-bold text-white uppercase tracking-wider bg-red-600 px-2 py-0.5 rounded">
            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
            Live
          </span>
        </div>
        <div className="overflow-hidden flex-1">
          <div
            className="flex gap-6 text-[11px] text-white group-hover/ticker:[animation-play-state:paused]"
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

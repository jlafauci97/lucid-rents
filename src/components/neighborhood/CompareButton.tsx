"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";

export function CompareButton({ neighborhoodName, zipCode, compareUrl }: { neighborhoodName: string; zipCode: string; compareUrl: string }) {
  return (
    <Link href={`${compareUrl}?a=${zipCode}`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-[#e2e8f0] rounded-lg text-sm font-medium text-[#0F1D2E] hover:border-[#3B82F6] hover:text-[#3B82F6] transition-colors">
      <ArrowLeftRight className="w-4 h-4" />
      Compare {neighborhoodName} with another neighborhood
    </Link>
  );
}

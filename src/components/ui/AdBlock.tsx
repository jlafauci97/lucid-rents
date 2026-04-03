'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdBlockProps {
  adSlot: string;
  adFormat?: 'horizontal' | 'rectangle' | 'vertical' | 'auto';
  className?: string;
}

const formatStyles: Record<string, React.CSSProperties> = {
  horizontal: { display: 'block', width: '100%', height: '90px' },
  rectangle: { display: 'inline-block', width: '300px', height: '250px' },
  vertical: { display: 'inline-block', width: '160px', height: '600px' },
  auto: { display: 'block' },
};

// Map ad format to real AdSense ad unit slot IDs
const SLOT_IDS: Record<string, string> = {
  horizontal: '1911276917',
  rectangle: '5523218861',
  vertical: '2437890529',
  auto: '1911276917',
};

export function AdBlock({ adSlot, adFormat = 'auto', className = '' }: AdBlockProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not loaded yet — expected in dev
    }
  }, []);

  const slotId = SLOT_IDS[adFormat] || SLOT_IDS.auto;

  return (
    <div className={`text-center my-6 ${className}`}>
      <span className="text-xs text-slate-400 block mb-1">Advertisement</span>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={formatStyles[adFormat]}
        data-ad-client="ca-pub-2908534121884582"
        data-ad-slot={slotId}
        data-ad-format={adFormat === 'auto' ? 'auto' : undefined}
        data-full-width-responsive={adFormat === 'auto' || adFormat === 'horizontal' ? 'true' : undefined}
      />
    </div>
  );
}

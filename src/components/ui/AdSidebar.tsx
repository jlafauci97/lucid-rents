import { AdBlock } from './AdBlock';

interface AdSidebarProps {
  children: React.ReactNode;
}

export function AdSidebar({ children }: AdSidebarProps) {
  return (
    <div className="flex justify-center gap-6 max-w-[1440px] mx-auto">
      {/* Left rail — hidden below xl */}
      <aside className="hidden xl:block w-[160px] flex-shrink-0">
        <div className="sticky top-20">
          <AdBlock adSlot="LEFT_RAIL" adFormat="vertical" />
        </div>
      </aside>

      {/* Main content — unchanged width */}
      <div className="flex-1 min-w-0">
        {children}
      </div>

      {/* Right rail — hidden below xl */}
      <aside className="hidden xl:block w-[160px] flex-shrink-0">
        <div className="sticky top-20">
          <AdBlock adSlot="RIGHT_RAIL" adFormat="vertical" />
        </div>
      </aside>
    </div>
  );
}

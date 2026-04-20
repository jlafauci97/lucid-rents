# Mission Control Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `/mission-control` as a unified hub that consolidates every operator feature (news drafts, data syncs, marketing, user account management, review moderation) behind a single password-gated entry with a dashboard landing page showing live stats for each feature.

**Architecture:**
- Consolidate the two existing mission-control entry points (`/mission-control/*` cookie-auth and `/profile/mission-control/*` sessionStorage-auth) into one at `/mission-control/*` using the existing HMAC cookie auth enforced by `src/proxy.ts`.
- Replace today's placeholder `/mission-control` (which doesn't exist — login redirects straight to news-drafts) with a real hub page: a grid of 5 feature cards, each showing a count/stat and an "Open" button to its sub-route.
- Add two brand-new sub-features: `/mission-control/users` (list, search, view detail, ban, delete, change role, impersonate) and `/mission-control/reviews` (recent reviews feed with flag/remove/restore).
- All pages use the existing pattern: Server Components fetch via Supabase service-role key, Server Actions for mutations, shared UI primitives from `src/components/ui/`.

**Tech Stack:**
- Next.js 16.2.1 App Router (note: middleware is at `src/proxy.ts`, renamed in Next 16)
- Supabase (auth + Postgres), Service Role for admin reads/writes
- Tailwind CSS 4.0 with project theme colors (`#3B82F6` primary, `#0F1D2E` dark, `#e2e8f0` borders)
- Vitest 4 + React Testing Library for unit tests
- lucide-react icons, framer-motion where useful
- Existing UI primitives: `src/components/ui/{Card,Button,Badge,Input,Select}.tsx`
- Existing auth: `src/lib/mission-control/auth.ts` (HMAC cookie, enforced in `src/proxy.ts`)

---

## File Structure

### Create

**Routes & server actions**
- `src/app/mission-control/layout.tsx` — Sidebar + header shell wrapping every MC page (replaces per-page nav)
- `src/app/mission-control/page.tsx` — Hub landing page: 5 feature cards with live stats
- `src/app/mission-control/users/page.tsx` — User list with search, pagination, new-user badge
- `src/app/mission-control/users/[id]/page.tsx` — User detail view
- `src/app/mission-control/users/actions.ts` — `banUser`, `unbanUser`, `deleteUser`, `setUserRole`, `impersonateUser`
- `src/app/mission-control/reviews/page.tsx` — Recent reviews feed (all auto-published) with flag/remove/restore
- `src/app/mission-control/reviews/actions.ts` — `flagReview`, `removeReview`, `restoreReview`
- `src/app/mission-control/syncs/page.tsx` — Moved from `/profile/mission-control/page.tsx`
- `src/app/mission-control/marketing/page.tsx` — Moved from `/profile/mission-control/marketing/page.tsx`
- `src/app/api/mission-control/stats/route.ts` — JSON aggregated counts for hub + polling

**Components**
- `src/components/mission-control/MCSidebar.tsx` — Left-hand nav with 5 feature links + active-state
- `src/components/mission-control/MCHeader.tsx` — Top bar with title + sign-out link
- `src/components/mission-control/HubCard.tsx` — Large feature card with stat, caption, Open button
- `src/components/mission-control/StatTile.tsx` — Small numeric stat display (used on sub-pages too)
- `src/components/mission-control/UsersTable.tsx` — Sortable/searchable user list
- `src/components/mission-control/UserDetailPanel.tsx` — Right-side detail view with action buttons
- `src/components/mission-control/ReviewsTable.tsx` — Review moderation table
- `src/components/mission-control/RecentActivityFeed.tsx` — Timeline of recent signups + reviews on hub

**Data layer & helpers**
- `src/lib/mission-control/stats.ts` — `getHubStats()` returns aggregated counts in one function
- `src/lib/mission-control/syncs-health.ts` — `fetchSyncsOk()` — read once in the hub page (NOT inside getHubStats; see Task 2.3)
- `src/lib/mission-control/users.ts` — `listUsers`, `getUserDetail`, `banUser`, `unbanUser`, `deleteUser`, `setUserRole`, `createImpersonationLink`
- `src/lib/mission-control/reviews.ts` — `listRecentReviews`, `moderateReview`

**Database migrations**
- `supabase/migrations/20260419120000_user_profiles_roles.sql` — `user_profiles` table with `role`, `deleted_at`, backfill from `auth.users`
- `supabase/migrations/20260419120100_reviews_status_values.sql` — ensure `reviews.updated_at` + permissive CHECK for `'draft'|'published'|'flagged'|'removed'`

**Tests (all co-located under `__tests__/`)**
- `src/lib/mission-control/__tests__/stats.test.ts`
- `src/lib/mission-control/__tests__/users.test.ts`
- `src/lib/mission-control/__tests__/reviews.test.ts`
- `src/components/mission-control/__tests__/HubCard.test.tsx`
- `src/components/mission-control/__tests__/StatTile.test.tsx`
- `src/components/mission-control/__tests__/MCSidebar.test.tsx`

### Modify
- `src/app/mission-control/login/page.tsx` — change post-login redirect from `/mission-control/news-drafts` to `/mission-control`
- `src/proxy.ts` — no change needed (already gates all `/mission-control/*` except `/login`)

### Delete (after moving contents)
- `src/app/profile/mission-control/page.tsx`
- `src/app/profile/mission-control/marketing/page.tsx`
- `src/app/profile/mission-control/marketing/_components/*` (move to `src/components/mission-control/marketing/`)
- Any related profile/mission-control directories once verified empty

---

## Phase 1 — Hub Shell & Landing Page

Goal: Ship a navigable hub with 5 feature cards (3 placeholder, 2 already-working links) before moving any existing code. Nothing breaks; news-drafts keeps working.

### Task 1.1: User profiles migration & role column + reviews.status verify

**Files:**
- Create: `supabase/migrations/20260419120000_user_profiles_roles.sql`
- Create: `supabase/migrations/20260419120100_reviews_status_values.sql`

Supabase Auth already supports ban (`banned_until`) and delete (`auth.admin.deleteUser()`) natively. We add a light `user_profiles` table for role + soft-delete tracking. RLS: only service role reads/writes.

`reviews.status` already exists (confirmed in `src/components/building/DeferredBuildingFAQ.tsx:46` and `src/app/api/checklist/route.ts`), but we don't know for certain that `'flagged'` and `'removed'` are accepted values (there may or may not be a CHECK constraint). The second migration is a safe no-op if no constraint exists, and it also ensures the `updated_at` column used by `moderateReview` is present.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260419120000_user_profiles_roles.sql
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'moderator', 'admin')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- No policies added: service-role bypasses RLS, anon/authenticated have no access.

-- Backfill one row per existing user.
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- Auto-insert on new signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists user_profiles_deleted_at_idx on public.user_profiles(deleted_at) where deleted_at is null;
```

- [ ] **Step 2: Write the reviews.status safety migration**

```sql
-- supabase/migrations/20260419120100_reviews_status_values.sql
-- Ensure reviews has an updated_at column (used by moderation).
alter table public.reviews
  add column if not exists updated_at timestamptz not null default now();

-- Drop any existing CHECK constraint on status so 'flagged'/'removed' are accepted.
-- Runs as a DO block so it's safe whether or not the constraint exists.
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.reviews drop constraint %I', c.conname);
  end loop;
end$$;

-- Add back a permissive CHECK that allows all moderation states.
alter table public.reviews
  add constraint reviews_status_check
  check (status in ('draft','published','flagged','removed'));

create index if not exists reviews_status_created_idx
  on public.reviews(status, created_at desc);
```

- [ ] **Step 3: Apply locally and verify**

Run: `npx supabase db push` (or the repo's preferred migration command — check `package.json`; if only remote, run via the Supabase MCP `apply_migration`).
Expected: migrations succeed; `select count(*) from user_profiles` roughly equals `select count(*) from auth.users`; `\d reviews` shows `updated_at` column and new `reviews_status_check` constraint.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260419120000_user_profiles_roles.sql supabase/migrations/20260419120100_reviews_status_values.sql
git commit -m "feat(mission-control): add user_profiles table + reviews.status safety migration"
```

---

### Task 1.2: Stats data layer with unit tests

**Files:**
- Create: `src/lib/mission-control/stats.ts`
- Create: `src/lib/mission-control/__tests__/stats.test.ts`

This exports a single `getHubStats()` returning all counts needed by the landing page.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mission-control/__tests__/stats.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mock — vitest hoists vi.mock above imports.
const from = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from })),
}));

import { getHubStats } from "../stats";

describe("getHubStats", () => {
  beforeEach(() => {
    from.mockReset();
  });

  it("returns aggregated counts from each table", async () => {
    // Each `from(table)` call returns a chainable that ends with `count`.
    const tables: Record<string, { count: number }> = {
      news_articles: { count: 4 },
      reviews: { count: 17 },
      auth_users: { count: 1523 },
      marketing_drafts: { count: 2 },
    };

    from.mockImplementation((table: string) => {
      const select = vi.fn().mockReturnThis();
      const eq = vi.fn().mockReturnThis();
      const gte = vi.fn().mockReturnThis();
      const order = vi.fn().mockReturnThis();
      const limit = vi.fn().mockResolvedValue({
        data: [],
        count: tables[table === "users" ? "auth_users" : table]?.count ?? 0,
        error: null,
      });
      return { select, eq, gte, order, limit };
    });

    const stats = await getHubStats();

    expect(stats).toMatchObject({
      newsDraftsPending: expect.any(Number),
      reviewsLast24h: expect.any(Number),
      usersTotal: expect.any(Number),
      usersNewLast7d: expect.any(Number),
      marketingDraftsPending: expect.any(Number),
    });
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `npm test -- stats.test.ts`
Expected: FAIL — "Cannot find module '../stats'".

- [ ] **Step 3: Implement stats.ts**

```ts
// src/lib/mission-control/stats.ts
import { createClient } from "@supabase/supabase-js";

export interface HubStats {
  newsDraftsPending: number;
  reviewsLast24h: number;
  reviewsFlagged: number;
  usersTotal: number;
  usersNewLast7d: number;
  marketingDraftsPending: number;
}

const ISO_7D_AGO = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const ISO_24H_AGO = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

export async function getHubStats(): Promise<HubStats> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const [
    newsDrafts,
    reviewsRecent,
    reviewsFlagged,
    usersTotal,
    usersNew,
    marketingDrafts,
  ] = await Promise.all([
    admin.from("news_articles").select("id", { count: "exact", head: true }).eq("status", "draft").eq("auto_generated", true),
    admin.from("reviews").select("id", { count: "exact", head: true }).gte("created_at", ISO_24H_AGO()),
    admin.from("reviews").select("id", { count: "exact", head: true }).eq("status", "flagged"),
    admin.from("user_profiles").select("user_id", { count: "exact", head: true }).is("deleted_at", null),
    admin.from("user_profiles").select("user_id", { count: "exact", head: true }).is("deleted_at", null).gte("created_at", ISO_7D_AGO()),
    admin.from("marketing_drafts").select("id", { count: "exact", head: true }).in("status", ["draft", "generating"]),
  ]);

  return {
    newsDraftsPending: newsDrafts.count ?? 0,
    reviewsLast24h: reviewsRecent.count ?? 0,
    reviewsFlagged: reviewsFlagged.count ?? 0,
    usersTotal: usersTotal.count ?? 0,
    usersNewLast7d: usersNew.count ?? 0,
    marketingDraftsPending: marketingDrafts.count ?? 0,
  };
}
```

Note `syncsOk` is intentionally NOT part of this function — syncs health is fetched independently in the hub page (Task 2.3) so `getHubStats` stays purely a Supabase-backed aggregation and its test only needs to mock `@supabase/supabase-js`.
```

- [ ] **Step 4: Run test to verify pass**

Run: `npm test -- stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-control/stats.ts src/lib/mission-control/__tests__/stats.test.ts
git commit -m "feat(mission-control): add getHubStats data layer"
```

---

### Task 1.3: HubCard + StatTile components

**Files:**
- Create: `src/components/mission-control/HubCard.tsx`
- Create: `src/components/mission-control/StatTile.tsx`
- Create: `src/components/mission-control/__tests__/HubCard.test.tsx`
- Create: `src/components/mission-control/__tests__/StatTile.test.tsx`

- [ ] **Step 1: Write HubCard failing test**

```tsx
// src/components/mission-control/__tests__/HubCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HubCard } from "../HubCard";

describe("HubCard", () => {
  it("renders title, description, stat, and link to href", () => {
    render(
      <HubCard
        title="News Drafts"
        description="Approve AI-generated articles"
        href="/mission-control/news-drafts"
        stat={{ value: 7, label: "pending" }}
        tone="primary"
      />,
    );
    expect(screen.getByText("News Drafts")).toBeInTheDocument();
    expect(screen.getByText("Approve AI-generated articles")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /open/i });
    expect(link).toHaveAttribute("href", "/mission-control/news-drafts");
  });

  it("renders warning tone when alert={true}", () => {
    const { container } = render(
      <HubCard
        title="Reviews"
        description=""
        href="/mission-control/reviews"
        stat={{ value: 3, label: "flagged" }}
        tone="warning"
      />,
    );
    expect(container.firstChild).toHaveClass(/amber/);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- HubCard.test.tsx`
Expected: FAIL — "Cannot find module '../HubCard'".

- [ ] **Step 3: Implement HubCard**

```tsx
// src/components/mission-control/HubCard.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export type HubCardTone = "primary" | "neutral" | "success" | "warning";

export interface HubCardProps {
  title: string;
  description: string;
  href: string;
  icon?: ReactNode;
  stat: { value: number | string; label: string };
  tone?: HubCardTone;
}

const toneClasses: Record<HubCardTone, string> = {
  primary: "border-[#3B82F6]/30 bg-[#0F1D2E] hover:border-[#3B82F6]",
  neutral: "border-slate-700 bg-[#0F1D2E] hover:border-slate-500",
  success: "border-emerald-500/30 bg-[#0F1D2E] hover:border-emerald-400",
  warning: "border-amber-500/40 bg-amber-950/20 hover:border-amber-400",
};

export function HubCard({ title, description, href, icon, stat, tone = "neutral" }: HubCardProps) {
  return (
    <div className={`rounded-xl border ${toneClasses[tone]} p-6 transition-colors flex flex-col gap-4`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-50">{stat.value}</span>
        <span className="text-sm text-slate-400">{stat.label}</span>
      </div>
      <Link
        href={href}
        className="mt-auto inline-flex items-center justify-center rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90"
      >
        Open
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- HubCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write StatTile test + implement**

```tsx
// src/components/mission-control/__tests__/StatTile.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatTile } from "../StatTile";

describe("StatTile", () => {
  it("renders value and label", () => {
    render(<StatTile value={42} label="users online" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("users online")).toBeInTheDocument();
  });
});
```

```tsx
// src/components/mission-control/StatTile.tsx
export interface StatTileProps {
  value: number | string;
  label: string;
}

export function StatTile({ value, label }: StatTileProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-[#0F1D2E] p-4">
      <div className="text-2xl font-bold text-slate-50">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}
```

Run: `npm test -- StatTile.test.tsx` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mission-control/HubCard.tsx src/components/mission-control/StatTile.tsx src/components/mission-control/__tests__/
git commit -m "feat(mission-control): add HubCard and StatTile components"
```

---

### Task 1.4: MCSidebar + MCHeader + layout.tsx

**Files:**
- Create: `src/components/mission-control/MCSidebar.tsx`
- Create: `src/components/mission-control/MCHeader.tsx`
- Create: `src/components/mission-control/__tests__/MCSidebar.test.tsx`
- Create: `src/app/mission-control/layout.tsx`

- [ ] **Step 1: Write MCSidebar failing test**

```tsx
// src/components/mission-control/__tests__/MCSidebar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MCSidebar } from "../MCSidebar";

describe("MCSidebar", () => {
  it("renders links to all 5 features + hub home", () => {
    render(<MCSidebar pathname="/mission-control/news-drafts" />);
    expect(screen.getByRole("link", { name: /hub/i })).toHaveAttribute("href", "/mission-control");
    expect(screen.getByRole("link", { name: /news drafts/i })).toHaveAttribute("href", "/mission-control/news-drafts");
    expect(screen.getByRole("link", { name: /syncs/i })).toHaveAttribute("href", "/mission-control/syncs");
    expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute("href", "/mission-control/users");
    expect(screen.getByRole("link", { name: /reviews/i })).toHaveAttribute("href", "/mission-control/reviews");
    expect(screen.getByRole("link", { name: /marketing/i })).toHaveAttribute("href", "/mission-control/marketing");
  });

  it("marks current path as aria-current=page", () => {
    render(<MCSidebar pathname="/mission-control/reviews" />);
    const active = screen.getByRole("link", { name: /reviews/i });
    expect(active).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- MCSidebar.test.tsx` → FAIL.

- [ ] **Step 3: Implement MCSidebar**

```tsx
// src/components/mission-control/MCSidebar.tsx
import Link from "next/link";
import { LayoutDashboard, Newspaper, Activity, Users, MessageSquare, Megaphone } from "lucide-react";

const NAV = [
  { href: "/mission-control", label: "Hub", icon: LayoutDashboard },
  { href: "/mission-control/news-drafts", label: "News Drafts", icon: Newspaper },
  { href: "/mission-control/syncs", label: "Syncs", icon: Activity },
  { href: "/mission-control/users", label: "Users", icon: Users },
  { href: "/mission-control/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/mission-control/marketing", label: "Marketing", icon: Megaphone },
] as const;

export function MCSidebar({ pathname }: { pathname: string }) {
  return (
    <nav className="w-60 shrink-0 border-r border-slate-800 bg-[#0B1625] p-4">
      <div className="mb-6 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Mission Control
      </div>
      <ul className="space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/mission-control" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- MCSidebar.test.tsx` → PASS.

- [ ] **Step 5: Implement MCHeader**

```tsx
// src/components/mission-control/MCHeader.tsx
export function MCHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-slate-800 bg-[#0F1D2E] px-8 py-5">
      <h1 className="text-xl font-bold text-slate-50">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
    </header>
  );
}
```

- [ ] **Step 6: Implement layout.tsx**

```tsx
// src/app/mission-control/layout.tsx
import { headers } from "next/headers";
import { MCSidebar } from "@/components/mission-control/MCSidebar";

export const dynamic = "force-dynamic";

export default async function MissionControlLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Next 16 exposes the request URL via headers() → x-invoke-path header is
  // not guaranteed; use the x-pathname if available, else rely on child usePathname.
  const h = await headers();
  const pathname = h.get("x-pathname") ?? h.get("referer") ?? "/mission-control";

  // Login page must not see the chrome.
  if (pathname.includes("/mission-control/login")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#050B14] text-slate-100">
      <MCSidebar pathname={pathname} />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
```

Note: Because `usePathname()` is client-only, and `headers().get('x-pathname')` isn't populated by Next 16 by default, a pragmatic fallback is to render the sidebar as a **Client Component** that uses `usePathname()`. Swap `MCSidebar` to `"use client"` and drop the `pathname` prop (read it inside via `usePathname()`). If you take that route, update the MCSidebar test to render inside a mocked `next/navigation`.

- [ ] **Step 7: Convert MCSidebar to Client Component (recommended)**

Change `src/components/mission-control/MCSidebar.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Newspaper, Activity, Users, MessageSquare, Megaphone } from "lucide-react";

const NAV = [ /* same as before */ ] as const;

export function MCSidebar() {
  const pathname = usePathname() ?? "/mission-control";
  // ...same render, derive `active` from local pathname
}
```

Update `MCSidebar.test.tsx` to mock `next/navigation`:

```tsx
import { vi } from "vitest";
vi.mock("next/navigation", () => ({
  usePathname: () => "/mission-control/reviews",
}));
```

And simplify `layout.tsx`:

```tsx
export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050B14] text-slate-100">
      <MCSidebar />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
```

The login page sits at `/mission-control/login` and will still render with the sidebar. That's ok temporarily — Task 1.6 handles hiding chrome on login.

- [ ] **Step 8: Commit**

```bash
git add src/components/mission-control/MCSidebar.tsx src/components/mission-control/MCHeader.tsx src/components/mission-control/__tests__/MCSidebar.test.tsx src/app/mission-control/layout.tsx
git commit -m "feat(mission-control): add shared layout with sidebar + header"
```

---

### Task 1.5: Hub landing page

**Files:**
- Create: `src/app/mission-control/page.tsx`
- Create: `src/app/api/mission-control/stats/route.ts`

- [ ] **Step 1: Write hub page**

```tsx
// src/app/mission-control/page.tsx
import { MCHeader } from "@/components/mission-control/MCHeader";
import { HubCard } from "@/components/mission-control/HubCard";
import { getHubStats } from "@/lib/mission-control/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MissionControlHub() {
  const stats = await getHubStats();

  // Syncs health is hardcoded true for Phase 1; Task 2.3 wires in the real check.
  const syncsOk = true;

  return (
    <>
      <MCHeader title="Mission Control" subtitle="Operator dashboard for lucidrents.com" />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <HubCard
            title="News Drafts"
            description="Approve or reject AI-generated articles."
            href="/mission-control/news-drafts"
            stat={{ value: stats.newsDraftsPending, label: "pending" }}
            tone={stats.newsDraftsPending > 0 ? "primary" : "neutral"}
          />
          <HubCard
            title="Syncs"
            description="Data pipeline health and cron status."
            href="/mission-control/syncs"
            stat={{ value: syncsOk ? "OK" : "FAIL", label: syncsOk ? "healthy" : "needs attention" }}
            tone={syncsOk ? "success" : "warning"}
          />
          <HubCard
            title="Users"
            description="Manage accounts, roles, and access."
            href="/mission-control/users"
            stat={{ value: stats.usersTotal, label: `total · +${stats.usersNewLast7d} this week` }}
            tone="neutral"
          />
          <HubCard
            title="Reviews"
            description="Moderate user-generated reviews."
            href="/mission-control/reviews"
            stat={{
              value: stats.reviewsLast24h,
              label: stats.reviewsFlagged > 0 ? `new · ${stats.reviewsFlagged} flagged` : "new in 24h",
            }}
            tone={stats.reviewsFlagged > 0 ? "warning" : "neutral"}
          />
          <HubCard
            title="Marketing"
            description="Content pipeline, Reddit, analytics."
            href="/mission-control/marketing"
            stat={{ value: stats.marketingDraftsPending, label: "drafts in queue" }}
            tone="neutral"
          />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Write stats API route (for future polling)**

```ts
// src/app/api/mission-control/stats/route.ts
import { NextResponse } from "next/server";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { getHubStats } from "@/lib/mission-control/stats";

export async function GET() {
  try {
    await requireMissionControl();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await getHubStats();
  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
```

- [ ] **Step 3: Update login redirect**

Edit `src/app/mission-control/login/page.tsx`: change the post-login redirect target from `/mission-control/news-drafts` to `/mission-control` (search for the string and replace it).

- [ ] **Step 4: Start dev server + verify in browser**

Run: `npm run dev`
Navigate to `http://localhost:3000/mission-control/login`, enter the password, get redirected to `/mission-control`, confirm the 5 cards render with stats. Click each card and confirm it routes (news-drafts will work; syncs/users/reviews/marketing will 404 until Phases 2–5 — that's expected).

Use `preview_start`, `preview_click`, `preview_snapshot`, `preview_screenshot` to verify. Do not ask the user to click anything.

- [ ] **Step 5: Commit**

```bash
git add src/app/mission-control/page.tsx src/app/api/mission-control/stats/route.ts src/app/mission-control/login/page.tsx
git commit -m "feat(mission-control): add hub landing page with live stats"
```

---

### Task 1.6: Login page — skip chrome

**Files:**
- Modify: `src/app/mission-control/layout.tsx`

The login page shouldn't show the sidebar. Simplest fix: move `login` out from under the layout by creating a route group.

- [ ] **Step 1: Move login under `(unauthenticated)` route group**

```bash
mkdir -p src/app/mission-control/\(unauthenticated\)
git mv src/app/mission-control/login src/app/mission-control/\(unauthenticated\)/login
```

Route groups in App Router (`(name)`) don't affect the URL — `/mission-control/login` still works — but they opt out of the parent `layout.tsx`. Add an empty `layout.tsx` inside the group so it uses root only:

```tsx
// src/app/mission-control/(unauthenticated)/layout.tsx
export default function UnauthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Verify login still works**

In browser: visit `/mission-control/login` — should render the bare login form, no sidebar. After login, redirects to `/mission-control` (the hub) which has the sidebar.

- [ ] **Step 3: Commit**

```bash
git add src/app/mission-control
git commit -m "fix(mission-control): isolate login page from hub layout"
```

---

## Phase 2 — Consolidate Syncs & Marketing

Goal: Move the two pages living under `/profile/mission-control/*` into the new hub, switch them from sessionStorage auth to the canonical cookie auth (they'll inherit from the proxy gate), and delete the old paths.

### Task 2.1: Move syncs dashboard

**Files:**
- Create: `src/app/mission-control/syncs/page.tsx`
- Delete: `src/app/profile/mission-control/page.tsx`

- [ ] **Step 1: Read existing syncs page to understand dependencies**

Read `src/app/profile/mission-control/page.tsx` and inventory its imports (API endpoints it calls, components, styling).

- [ ] **Step 2: Create new syncs page as near-copy**

Copy the JSX/logic into `src/app/mission-control/syncs/page.tsx`, but:
- Remove the sessionStorage password gate entirely (the proxy already blocks unauthenticated access)
- Remove the `NEXT_PUBLIC_MC_PASSWORD` check
- Wrap the content with `<MCHeader title="Syncs" subtitle="Cron jobs, data pipelines, RPC health" />` and render inside a `<main className="flex-1 overflow-y-auto p-8">`
- Keep the 60s polling behavior
- Update `syncsOk` in `stats.ts` Phase-1 placeholder to reflect the real health check (Phase 3 — flag for later)

- [ ] **Step 3: Verify in browser**

`preview_start`, navigate to `/mission-control/syncs`, confirm the health dashboard renders identically to the old `/profile/mission-control` page. Check `preview_console_logs` for errors.

- [ ] **Step 4: Delete old location**

```bash
git rm -r src/app/profile/mission-control/page.tsx
# If the profile/mission-control directory is now empty or only had this file, remove the directory.
```

Verify nothing links to `/profile/mission-control`:

Run: `grep -r "profile/mission-control" src/` — expected: no results other than marketing (Task 2.2 handles it).

- [ ] **Step 5: Commit**

```bash
git add src/app/mission-control/syncs/page.tsx src/app/profile
git commit -m "refactor(mission-control): move syncs dashboard under /mission-control/syncs"
```

---

### Task 2.2: Move marketing dashboard

**Files:**
- Create: `src/app/mission-control/marketing/page.tsx`
- Create: `src/components/mission-control/marketing/` (move all sub-components)
- Delete: `src/app/profile/mission-control/marketing/` (entire directory)

- [ ] **Step 1: Inventory marketing sub-components**

Run: `ls src/app/profile/mission-control/marketing/_components/` to list all files.

- [ ] **Step 2: Move sub-components**

```bash
mkdir -p src/components/mission-control/marketing
git mv src/app/profile/mission-control/marketing/_components/* src/components/mission-control/marketing/
```

- [ ] **Step 3: Copy marketing page**

Copy `src/app/profile/mission-control/marketing/page.tsx` to `src/app/mission-control/marketing/page.tsx`. Update imports to point to the new component location (`@/components/mission-control/marketing/...`). Remove any sessionStorage auth logic. Wrap with `<MCHeader title="Marketing" subtitle="Content pipeline, Reddit, analytics" />`.

- [ ] **Step 4: Verify in browser**

Navigate to `/mission-control/marketing`, confirm tabs render (Create Post, Content Queue, Reddit, Analytics), data loads. Check console for import errors.

- [ ] **Step 5: Delete old marketing location**

```bash
git rm -r src/app/profile/mission-control/marketing
```

Run: `grep -r "profile/mission-control/marketing" src/` — expected: no results.

- [ ] **Step 6: Commit**

```bash
git add src/app/mission-control/marketing src/components/mission-control/marketing src/app/profile
git commit -m "refactor(mission-control): move marketing dashboard under /mission-control/marketing"
```

---

### Task 2.3: Wire real `syncsOk` into hub page

**Files:**
- Create: `src/lib/mission-control/syncs-health.ts`
- Modify: `src/app/mission-control/page.tsx`

Fetched in the hub page (not in `getHubStats`) so the stats test stays pure-Supabase and doesn't need to stub `fetch`.

- [ ] **Step 1: Find the syncs page's health check logic**

Read `src/app/mission-control/syncs/page.tsx` (moved in Task 2.1) and identify the "ok" condition — likely based on `/api/health` response fields (`body.status === "ok"` or similar).

- [ ] **Step 2: Create the helper**

```ts
// src/lib/mission-control/syncs-health.ts
export async function fetchSyncsOk(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/health`, {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = await res.json();
    // Mirror the "ok" rollup the syncs page uses — adjust field to match.
    return body.status === "ok";
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Call it from the hub page**

In `src/app/mission-control/page.tsx`, replace the `const syncsOk = true;` line with:

```ts
import { fetchSyncsOk } from "@/lib/mission-control/syncs-health";
// ... at the top of the component, in place of `const syncsOk = true;`:
const [stats, syncsOk] = await Promise.all([getHubStats(), fetchSyncsOk()]);
```

- [ ] **Step 4: Verify in browser**

Hub card for Syncs should show OK when `/api/health` returns 200 with `status: "ok"`, FAIL otherwise. Temporarily break the health endpoint (or stub it) to confirm the failure path renders tone="warning".

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-control/syncs-health.ts src/app/mission-control/page.tsx
git commit -m "feat(mission-control): wire real syncs health into hub page"
```

---

## Phase 3 — User Accounts

Goal: Build `/mission-control/users` with list, search, detail, ban, delete, role change, impersonation, and a "new signups" indicator.

### Task 3.1: Users data layer

**Files:**
- Create: `src/lib/mission-control/users.ts`
- Create: `src/lib/mission-control/__tests__/users.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/mission-control/__tests__/users.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authAdmin = {
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  generateLink: vi.fn(),
};
const from = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { admin: authAdmin },
    from,
  })),
}));

import { listUsers, getUserDetail, banUser, unbanUser, deleteUser, setUserRole } from "../users";

describe("listUsers", () => {
  beforeEach(() => {
    authAdmin.listUsers.mockReset();
    from.mockReset();
  });

  it("returns paged users joined with profile role", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "a@x.com", created_at: "2026-04-18T00:00:00Z", banned_until: null, last_sign_in_at: "2026-04-19T00:00:00Z" },
        ],
      },
      error: null,
    });
    from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ user_id: "u1", role: "user", deleted_at: null }],
        error: null,
      }),
    }));

    const { users } = await listUsers({ page: 1, pageSize: 20 });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: "u1", email: "a@x.com", role: "user", banned: false });
  });

  it("filters in-memory by search term (page-scoped only — known limitation)", async () => {
    authAdmin.listUsers.mockResolvedValue({
      data: {
        users: [
          { id: "u1", email: "alice@x.com", created_at: "2026-04-18T00:00:00Z", banned_until: null, last_sign_in_at: null },
          { id: "u2", email: "bob@x.com", created_at: "2026-04-18T00:00:00Z", banned_until: null, last_sign_in_at: null },
        ],
      },
      error: null,
    });
    from.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    }));
    const { users } = await listUsers({ page: 1, pageSize: 20, search: "alice" });
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("alice@x.com");
  });
});

describe("banUser", () => {
  it("sets banned_until to 100 years from now", async () => {
    authAdmin.updateUserById.mockResolvedValue({ data: {}, error: null });
    await banUser("u1");
    expect(authAdmin.updateUserById).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ ban_duration: expect.stringMatching(/h$/) }),
    );
  });
});

describe("setUserRole", () => {
  it("upserts into user_profiles", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ upsert });
    await setUserRole("u1", "admin");
    expect(upsert).toHaveBeenCalledWith({ user_id: "u1", role: "admin" });
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- users.test.ts` → FAIL.

- [ ] **Step 3: Implement users.ts**

```ts
// src/lib/mission-control/users.ts
import { createClient } from "@supabase/supabase-js";

export type UserRole = "user" | "moderator" | "admin";

export interface MCUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
  role: UserRole;
  deleted_at: string | null;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * Lists one page of users joined with their profile row.
 *
 * KNOWN LIMITATION: `search` only filters users already on the current page.
 * Supabase auth.admin has no server-side email search. If cross-page search
 * becomes required, add a `user_emails` view that joins auth.users.email into
 * a RLS-restricted public view and query from there.
 */
export async function listUsers({
  page = 1,
  pageSize = 20,
  search,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ users: MCUser[]; hasMore: boolean }> {
  const sb = admin();
  const { data: authData, error } = await sb.auth.admin.listUsers({ page, perPage: pageSize });
  if (error) throw error;

  const rawUsers = authData.users;
  // Request pageSize + any extra = hasMore if Supabase returned exactly pageSize.
  const hasMore = rawUsers.length === pageSize;

  let users = rawUsers;
  if (search) {
    const q = search.toLowerCase();
    users = users.filter((u) => u.email?.toLowerCase().includes(q) || u.id.includes(q));
  }

  const ids = users.map((u) => u.id);
  const { data: profiles } = await sb
    .from("user_profiles")
    .select("user_id, role, deleted_at")
    .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);

  return {
    users: users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      role: (profileMap.get(u.id)?.role as UserRole) ?? "user",
      deleted_at: profileMap.get(u.id)?.deleted_at ?? null,
    })),
    hasMore,
  };
}

export async function getUserDetail(userId: string): Promise<MCUser & { reviewsCount: number }> {
  const sb = admin();
  const [userRes, profileRes, reviewsRes] = await Promise.all([
    sb.auth.admin.getUserById(userId),
    sb.from("user_profiles").select("role, deleted_at").eq("user_id", userId).maybeSingle(),
    sb.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (userRes.error || !userRes.data.user) throw userRes.error ?? new Error("User not found");
  const u = userRes.data.user;
  return {
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
    role: (profileRes.data?.role as UserRole) ?? "user",
    deleted_at: profileRes.data?.deleted_at ?? null,
    reviewsCount: reviewsRes.count ?? 0,
  };
}

export async function banUser(userId: string): Promise<void> {
  const sb = admin();
  const hours = 876000; // ~100 years
  const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: `${hours}h` });
  if (error) throw error;
}

export async function unbanUser(userId: string): Promise<void> {
  const sb = admin();
  const { error } = await sb.auth.admin.updateUserById(userId, { ban_duration: "none" });
  if (error) throw error;
}

export async function deleteUser(userId: string): Promise<void> {
  const sb = admin();
  // Soft delete first (audit trail), then hard delete from auth.
  await sb
    .from("user_profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId);
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const sb = admin();
  const { error } = await sb.from("user_profiles").upsert({ user_id: userId, role });
  if (error) throw error;
}

export async function createImpersonationLink(userId: string): Promise<string> {
  const sb = admin();
  const { data: user } = await sb.auth.admin.getUserById(userId);
  if (!user.user?.email) throw new Error("User has no email");
  const { data, error } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: user.user.email,
  });
  if (error) throw error;
  return data.properties?.action_link ?? "";
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- users.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-control/users.ts src/lib/mission-control/__tests__/users.test.ts
git commit -m "feat(mission-control): add users data layer"
```

---

### Task 3.2: UsersTable component

**Files:**
- Create: `src/components/mission-control/UsersTable.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/components/mission-control/UsersTable.tsx
import Link from "next/link";
import type { MCUser } from "@/lib/mission-control/users";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function UsersTable({ users }: { users: MCUser[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Joined</th>
            <th className="px-4 py-3">Last sign-in</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-900/30">
              <td className="px-4 py-3 text-slate-100">{u.email || <span className="italic text-slate-500">(no email)</span>}</td>
              <td className="px-4 py-3 text-slate-300">{u.role}</td>
              <td className="px-4 py-3">
                {u.banned ? (
                  <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">Banned</span>
                ) : u.deleted_at ? (
                  <span className="rounded bg-slate-500/15 px-2 py-0.5 text-xs text-slate-400">Deleted</span>
                ) : (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Active</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(u.created_at)}</td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(u.last_sign_in_at)}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/mission-control/users/${u.id}`}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-slate-500">No users.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/mission-control/UsersTable.tsx
git commit -m "feat(mission-control): add UsersTable component"
```

---

### Task 3.3: Users list page

**Files:**
- Create: `src/app/mission-control/users/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/mission-control/users/page.tsx
import { MCHeader } from "@/components/mission-control/MCHeader";
import { StatTile } from "@/components/mission-control/StatTile";
import { UsersTable } from "@/components/mission-control/UsersTable";
import { listUsers } from "@/lib/mission-control/users";
import { getHubStats } from "@/lib/mission-control/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const [{ users, hasMore }, stats] = await Promise.all([
    listUsers({ page: pageNum, pageSize: 20, search: q }),
    getHubStats(),
  ]);

  return (
    <>
      <MCHeader title="Users" subtitle="Manage accounts, roles, access." />
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatTile value={stats.usersTotal} label="total users" />
          <StatTile value={stats.usersNewLast7d} label="new this week" />
          <StatTile value={users.length} label="shown on this page" />
        </div>

        <form className="flex gap-2" action="/mission-control/users" method="get">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search email or user ID (current page only)…"
            className="flex-1 rounded-md border border-slate-700 bg-[#0F1D2E] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#3B82F6] focus:outline-none"
          />
          <button type="submit" className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white">
            Search
          </button>
        </form>
        {q && (
          <p className="text-xs text-amber-400/80">
            Heads-up: search filters only the current page of results. Paginate to find users on later pages.
          </p>
        )}

        <UsersTable users={users} />

        <div className="flex justify-between text-sm text-slate-400">
          <span>Page {pageNum}</span>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <a
                href={`/mission-control/users?page=${pageNum - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded bg-slate-800 px-3 py-1 text-slate-200"
              >
                Previous
              </a>
            )}
            {hasMore && (
              <a
                href={`/mission-control/users?page=${pageNum + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                className="rounded bg-slate-800 px-3 py-1 text-slate-200"
              >
                Next
              </a>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `/mission-control/users`, confirm list renders, search for an email returns filtered results, pagination works.

- [ ] **Step 3: Commit**

```bash
git add src/app/mission-control/users/page.tsx
git commit -m "feat(mission-control): add users list page"
```

---

### Task 3.4: User actions (server actions)

**Files:**
- Create: `src/app/mission-control/users/actions.ts`

- [ ] **Step 1: Implement**

```ts
// src/app/mission-control/users/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMissionControl } from "@/lib/mission-control/auth";
import {
  banUser,
  unbanUser,
  deleteUser,
  setUserRole,
  createImpersonationLink,
  type UserRole,
} from "@/lib/mission-control/users";

const USER_PATH = (id: string) => `/mission-control/users/${id}`;

export async function banUserAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  await banUser(id);
  revalidatePath(USER_PATH(id));
  revalidatePath("/mission-control/users");
}

export async function unbanUserAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  await unbanUser(id);
  revalidatePath(USER_PATH(id));
  revalidatePath("/mission-control/users");
}

export async function deleteUserAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  await deleteUser(id);
  revalidatePath("/mission-control/users");
  redirect("/mission-control/users");
}

export async function setUserRoleAction(formData: FormData) {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  const role = String(formData.get("role")) as UserRole;
  await setUserRole(id, role);
  revalidatePath(USER_PATH(id));
}

export async function impersonateUserAction(formData: FormData): Promise<{ link: string }> {
  await requireMissionControl();
  const id = String(formData.get("userId"));
  const link = await createImpersonationLink(id);
  return { link };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/mission-control/users/actions.ts
git commit -m "feat(mission-control): add user server actions"
```

---

### Task 3.5: User detail page

**Files:**
- Create: `src/app/mission-control/users/[id]/page.tsx`
- Create: `src/components/mission-control/UserActionsBar.tsx` (client component)

- [ ] **Step 1: Implement action bar (client)**

```tsx
// src/components/mission-control/UserActionsBar.tsx
"use client";
import { useState } from "react";
import type { UserRole } from "@/lib/mission-control/users";

interface Props {
  userId: string;
  banned: boolean;
  role: UserRole;
  onBan: (fd: FormData) => Promise<void>;
  onUnban: (fd: FormData) => Promise<void>;
  onDelete: (fd: FormData) => Promise<void>;
  onSetRole: (fd: FormData) => Promise<void>;
  onImpersonate: (fd: FormData) => Promise<{ link: string }>;
}

export function UserActionsBar({ userId, banned, role, onBan, onUnban, onDelete, onSetRole, onImpersonate }: Props) {
  const [impersonateLink, setImpersonateLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: (fd: FormData) => Promise<void>) {
    setError(null);
    const fd = new FormData();
    fd.append("userId", userId);
    try {
      await action(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function doImpersonate() {
    setError(null);
    const fd = new FormData();
    fd.append("userId", userId);
    try {
      const { link } = await onImpersonate(fd);
      setImpersonateLink(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  async function changeRole(newRole: UserRole) {
    setError(null);
    const fd = new FormData();
    fd.append("userId", userId);
    fd.append("role", newRole);
    try {
      await onSetRole(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {banned ? (
          <button onClick={() => run(onUnban)} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">Unban</button>
        ) : (
          <button onClick={() => run(onBan)} className="rounded bg-amber-600 px-3 py-2 text-sm text-white">Ban</button>
        )}
        <button
          onClick={() => {
            if (confirm("Permanently delete this account and all auth records?")) run(onDelete);
          }}
          className="rounded bg-red-600 px-3 py-2 text-sm text-white"
        >
          Delete
        </button>
        <button onClick={doImpersonate} className="rounded bg-slate-700 px-3 py-2 text-sm text-white">
          Get impersonation link
        </button>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-slate-400">Role:</span>
        <select
          defaultValue={role}
          onChange={(e) => changeRole(e.target.value as UserRole)}
          className="rounded border border-slate-700 bg-[#0F1D2E] px-2 py-1 text-slate-100"
        >
          <option value="user">user</option>
          <option value="moderator">moderator</option>
          <option value="admin">admin</option>
        </select>
      </div>

      {impersonateLink && (
        <div className="rounded border border-slate-700 bg-slate-900 p-3 text-xs">
          <div className="mb-1 text-slate-400">Magic link (valid for 1 hour):</div>
          <code className="break-all text-slate-200">{impersonateLink}</code>
        </div>
      )}
      {error && <div className="text-sm text-red-400">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Implement detail page**

```tsx
// src/app/mission-control/users/[id]/page.tsx
import { notFound } from "next/navigation";
import { MCHeader } from "@/components/mission-control/MCHeader";
import { UserActionsBar } from "@/components/mission-control/UserActionsBar";
import { getUserDetail } from "@/lib/mission-control/users";
import {
  banUserAction,
  unbanUserAction,
  deleteUserAction,
  setUserRoleAction,
  impersonateUserAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user: Awaited<ReturnType<typeof getUserDetail>>;
  try {
    user = await getUserDetail(id);
  } catch {
    notFound();
  }

  return (
    <>
      <MCHeader title={user.email || user.id} subtitle={`Joined ${new Date(user.created_at).toLocaleDateString()}`} />
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <dl className="grid grid-cols-2 gap-4 max-w-2xl">
          <div>
            <dt className="text-xs uppercase text-slate-500">User ID</dt>
            <dd className="font-mono text-sm text-slate-200">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Email</dt>
            <dd className="text-sm text-slate-200">{user.email || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Role</dt>
            <dd className="text-sm text-slate-200">{user.role}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Status</dt>
            <dd className="text-sm text-slate-200">
              {user.banned ? "Banned" : user.deleted_at ? "Deleted" : "Active"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Last sign-in</dt>
            <dd className="text-sm text-slate-200">
              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "never"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-slate-500">Reviews written</dt>
            <dd className="text-sm text-slate-200">{user.reviewsCount}</dd>
          </div>
        </dl>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Actions</h2>
          <UserActionsBar
            userId={user.id}
            banned={user.banned}
            role={user.role}
            onBan={banUserAction}
            onUnban={unbanUserAction}
            onDelete={deleteUserAction}
            onSetRole={setUserRoleAction}
            onImpersonate={impersonateUserAction}
          />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify in browser**

Click a user from the list → detail page loads. Change role (dropdown) → page revalidates. Click Ban → status updates. Click "Get impersonation link" → link appears. **Do not click Delete on a real account** during verification.

- [ ] **Step 4: Commit**

```bash
git add src/app/mission-control/users/\[id\]/page.tsx src/components/mission-control/UserActionsBar.tsx
git commit -m "feat(mission-control): add user detail page with action bar"
```

---

### Task 3.6: Recent activity feed (new users on hub)

**Files:**
- Modify: `src/lib/mission-control/stats.ts` — add `recentSignups`
- Modify: `src/app/mission-control/page.tsx` — render feed
- Create: `src/components/mission-control/RecentActivityFeed.tsx`

- [ ] **Step 1: Extend `getHubStats`**

Add `recentSignups: { id: string; email: string; created_at: string }[]` populated by querying `auth.users` ordered by `created_at desc limit 10`.

```ts
// In getHubStats, after the Promise.all
const { data: signups } = await admin.auth.admin.listUsers({ page: 1, perPage: 10 });
const recentSignups = (signups?.users ?? []).map((u) => ({
  id: u.id,
  email: u.email ?? "",
  created_at: u.created_at,
}));
```

- [ ] **Step 2: Add RecentActivityFeed component**

```tsx
// src/components/mission-control/RecentActivityFeed.tsx
import Link from "next/link";

export interface Signup { id: string; email: string; created_at: string }

export function RecentActivityFeed({ signups }: { signups: Signup[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#0F1D2E] p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Recent signups</h3>
      <ul className="space-y-2">
        {signups.map((s) => (
          <li key={s.id} className="flex items-center justify-between text-sm">
            <Link href={`/mission-control/users/${s.id}`} className="text-slate-200 hover:text-[#3B82F6]">
              {s.email || s.id}
            </Link>
            <span className="text-xs text-slate-500">{new Date(s.created_at).toLocaleString()}</span>
          </li>
        ))}
        {signups.length === 0 && <li className="text-sm text-slate-500">No recent signups.</li>}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Render on hub page**

Below the grid of cards, add:

```tsx
<div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
  <RecentActivityFeed signups={stats.recentSignups} />
  {/* Reviews feed added in Phase 4 */}
</div>
```

- [ ] **Step 4: Update stats test for new field and verify in browser**

Check that the hub shows recent signups below the cards.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-control/stats.ts src/app/mission-control/page.tsx src/components/mission-control/RecentActivityFeed.tsx
git commit -m "feat(mission-control): add recent signups feed to hub"
```

---

## Phase 4 — Reviews Moderation

Goal: Build `/mission-control/reviews` — feed of recently published reviews with who posted, when, and moderation actions (flag/remove/restore). Reviews are auto-posted; the page is a watchlist + moderation surface.

### Task 4.1: Reviews data layer

**Files:**
- Create: `src/lib/mission-control/reviews.ts`
- Create: `src/lib/mission-control/__tests__/reviews.test.ts`

- [ ] **Step 1: Write failing tests (same pattern as users.test.ts)**

Cover `listRecentReviews` returning reviews with joined building name and reviewer email, and `moderateReview` updating the status.

- [ ] **Step 2: Implement**

```ts
// src/lib/mission-control/reviews.ts
import { createClient } from "@supabase/supabase-js";

export type ReviewStatus = "draft" | "published" | "flagged" | "removed";

export interface MCReview {
  id: string;
  user_id: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  building_id: string;
  building_address: string | null;
  building_city: string | null;
  title: string | null;
  overall_rating: number | null;
  status: ReviewStatus;
  created_at: string;
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function listRecentReviews({
  status,
  limit = 50,
}: {
  status?: ReviewStatus | "all";
  limit?: number;
} = {}): Promise<MCReview[]> {
  const sb = admin();
  let query = sb
    .from("reviews")
    .select(`
      id, user_id, reviewer_name, building_id, title, overall_rating, status, created_at,
      buildings(full_address, metro)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw error;

  // Join reviewer emails. Supabase auth.admin has no batch email lookup, so
  // for the default limit=50 this is up to 50 parallel getUserById calls.
  // This is acceptable for a moderation dashboard (low QPS, single-operator
  // usage). If it becomes slow, create a `reviewer_emails` view that joins
  // auth.users.email via a security-definer function and query it once.
  const userIds = Array.from(new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)));
  const emailMap = new Map<string, string>();
  await Promise.all(
    userIds.map(async (uid) => {
      const { data: u } = await sb.auth.admin.getUserById(uid as string);
      if (u?.user?.email) emailMap.set(uid as string, u.user.email);
    }),
  );

  return (data ?? []).map((r: any) => ({
    id: r.id,
    user_id: r.user_id,
    reviewer_name: r.reviewer_name,
    reviewer_email: r.user_id ? (emailMap.get(r.user_id) ?? null) : null,
    building_id: r.building_id,
    building_address: r.buildings?.full_address ?? null,
    building_city: r.buildings?.metro ?? null,
    title: r.title,
    overall_rating: r.overall_rating,
    status: r.status,
    created_at: r.created_at,
  }));
}

export async function moderateReview(id: string, status: ReviewStatus): Promise<void> {
  const sb = admin();
  const { error } = await sb
    .from("reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 3: Run tests → PASS**

Run: `npm test -- reviews.test.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mission-control/reviews.ts src/lib/mission-control/__tests__/reviews.test.ts
git commit -m "feat(mission-control): add reviews data layer"
```

---

### Task 4.2: ReviewsTable + moderation actions

**Files:**
- Create: `src/components/mission-control/ReviewsTable.tsx` (Client Component)
- Create: `src/app/mission-control/reviews/actions.ts`

- [ ] **Step 1: Implement server actions**

```ts
// src/app/mission-control/reviews/actions.ts
"use server";
import { revalidatePath } from "next/cache";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { moderateReview } from "@/lib/mission-control/reviews";

export async function flagReview(formData: FormData) {
  await requireMissionControl();
  await moderateReview(String(formData.get("id")), "flagged");
  revalidatePath("/mission-control/reviews");
}
export async function removeReview(formData: FormData) {
  await requireMissionControl();
  await moderateReview(String(formData.get("id")), "removed");
  revalidatePath("/mission-control/reviews");
}
export async function restoreReview(formData: FormData) {
  await requireMissionControl();
  await moderateReview(String(formData.get("id")), "published");
  revalidatePath("/mission-control/reviews");
}
```

- [ ] **Step 2: Implement table**

```tsx
// src/components/mission-control/ReviewsTable.tsx
"use client";

import Link from "next/link";
import type { MCReview, ReviewStatus } from "@/lib/mission-control/reviews";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  published: "bg-emerald-500/15 text-emerald-300",
  flagged: "bg-amber-500/15 text-amber-300",
  removed: "bg-red-500/15 text-red-300",
  draft: "bg-slate-500/15 text-slate-400",
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  reviews: MCReview[];
  onFlag: (fd: FormData) => Promise<void>;
  onRemove: (fd: FormData) => Promise<void>;
  onRestore: (fd: FormData) => Promise<void>;
}

export function ReviewsTable({ reviews, onFlag, onRemove, onRestore }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/50 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Reviewer</th>
            <th className="px-4 py-3">Building</th>
            <th className="px-4 py-3">Rating</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Posted</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {reviews.map((r) => (
            <tr key={r.id} className="hover:bg-slate-900/30 align-top">
              <td className="px-4 py-3">
                {r.user_id ? (
                  <Link href={`/mission-control/users/${r.user_id}`} className="text-slate-100 hover:text-[#3B82F6]">
                    {r.reviewer_email || r.reviewer_name || "(unknown)"}
                  </Link>
                ) : (
                  <span className="text-slate-400">{r.reviewer_name || "scraped"}</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-300">
                <div>{r.building_address ?? r.building_id}</div>
                {r.building_city && <div className="text-xs text-slate-500">{r.building_city}</div>}
              </td>
              <td className="px-4 py-3 text-slate-300">{r.overall_rating ?? "—"}</td>
              <td className="px-4 py-3">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[r.status]}`}>{r.status}</span>
              </td>
              <td className="px-4 py-3 text-slate-400">{timeAgo(r.created_at)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  {r.status !== "flagged" && (
                    <form action={onFlag}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded bg-amber-600/80 px-2 py-1 text-xs text-white">Flag</button>
                    </form>
                  )}
                  {r.status !== "removed" && (
                    <form action={onRemove}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded bg-red-600/80 px-2 py-1 text-xs text-white">Remove</button>
                    </form>
                  )}
                  {(r.status === "flagged" || r.status === "removed") && (
                    <form action={onRestore}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded bg-emerald-600/80 px-2 py-1 text-xs text-white">Restore</button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {reviews.length === 0 && (
            <tr><td colSpan={6} className="p-8 text-center text-slate-500">No reviews.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/mission-control/ReviewsTable.tsx src/app/mission-control/reviews/actions.ts
git commit -m "feat(mission-control): add ReviewsTable + moderation server actions"
```

---

### Task 4.3: Reviews page

**Files:**
- Create: `src/app/mission-control/reviews/page.tsx`

- [ ] **Step 1: Implement**

```tsx
// src/app/mission-control/reviews/page.tsx
import { MCHeader } from "@/components/mission-control/MCHeader";
import { StatTile } from "@/components/mission-control/StatTile";
import { ReviewsTable } from "@/components/mission-control/ReviewsTable";
import { listRecentReviews } from "@/lib/mission-control/reviews";
import { getHubStats } from "@/lib/mission-control/stats";
import { flagReview, removeReview, restoreReview } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TABS = ["published", "flagged", "removed", "all"] as const;
type Tab = (typeof TABS)[number];

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "published";

  const [reviews, stats] = await Promise.all([
    listRecentReviews({ status: activeTab, limit: 100 }),
    getHubStats(),
  ]);

  return (
    <>
      <MCHeader title="Reviews" subtitle="Monitor and moderate user reviews." />
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <StatTile value={stats.reviewsLast24h} label="new in 24h" />
          <StatTile value={stats.reviewsFlagged} label="flagged" />
          <StatTile value={reviews.length} label="shown" />
        </div>

        <div className="flex gap-2 border-b border-slate-800">
          {TABS.map((t) => (
            <a
              key={t}
              href={`/mission-control/reviews?tab=${t}`}
              className={`px-3 py-2 text-sm capitalize ${
                t === activeTab ? "border-b-2 border-[#3B82F6] text-[#3B82F6]" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t}
            </a>
          ))}
        </div>

        <ReviewsTable
          reviews={reviews}
          onFlag={flagReview}
          onRemove={removeReview}
          onRestore={restoreReview}
        />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `/mission-control/reviews`. Confirm recent reviews list. Click Flag → row status updates to flagged. Switch tabs → see filtered lists. Click Restore on a flagged review → back to published.

- [ ] **Step 3: Commit**

```bash
git add src/app/mission-control/reviews/page.tsx
git commit -m "feat(mission-control): add reviews moderation page"
```

---

### Task 4.4: Recent reviews feed on hub

**Files:**
- Modify: `src/lib/mission-control/stats.ts` — add `recentReviews`
- Modify: `src/app/mission-control/page.tsx` — render second feed

- [ ] **Step 1: Extend `getHubStats`**

Add `recentReviews: MCReview[]` by calling `listRecentReviews({ status: "all", limit: 10 })` inside `getHubStats` (or refactor to leave stats pure and load reviews separately on the hub page — the latter is cleaner).

Recommended: fetch `recentReviews` inside the hub page itself:

```tsx
// src/app/mission-control/page.tsx
const [stats, recentReviews] = await Promise.all([
  getHubStats(),
  listRecentReviews({ status: "all", limit: 10 }),
]);
```

- [ ] **Step 2: Create RecentReviewsFeed component**

Similar to `RecentActivityFeed.tsx`. Show `reviewer_email`, `building_address`, rating, `timeAgo(created_at)`. Each row links to `/mission-control/reviews?highlight={id}` (highlight support can be added later; for now just link to the reviews page).

- [ ] **Step 3: Render below signups on hub**

```tsx
<div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-5">
  <RecentActivityFeed signups={stats.recentSignups} />
  <RecentReviewsFeed reviews={recentReviews} />
</div>
```

- [ ] **Step 4: Verify in browser**

Hub page now shows two side-by-side feeds: recent signups and recent reviews.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-control src/app/mission-control/page.tsx src/components/mission-control/RecentReviewsFeed.tsx
git commit -m "feat(mission-control): add recent reviews feed to hub"
```

---

## Phase 5 — Polish & Notifications

Goal: Light polish — make the hub feel live, verify the auth round-trip, and handle edge cases.

### Task 5.1: Client-side poll for live stats on hub

**Files:**
- Create: `src/components/mission-control/HubStatsClient.tsx` (client component)
- Modify: `src/app/mission-control/page.tsx` — use the client component for cards

The hub today renders stats server-side once. Add 30s polling via `/api/mission-control/stats` so counts update without page refresh.

- [ ] **Step 1: Implement HubStatsClient**

```tsx
// src/components/mission-control/HubStatsClient.tsx
"use client";
import { useEffect, useState } from "react";
import { HubCard } from "./HubCard";
import type { HubStats } from "@/lib/mission-control/stats";

export function HubStatsClient({ initial }: { initial: HubStats }) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch("/api/mission-control/stats", { cache: "no-store" });
        if (res.ok) setStats(await res.json());
      } catch {
        // ignore transient errors
      }
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {/* same HubCard JSX as server page, driven by stats state */}
    </div>
  );
}
```

Move the 5 HubCard blocks from the server page into this client component. The server page passes `initial={stats}`.

- [ ] **Step 2: Verify in browser**

Open devtools Network tab, confirm a fetch to `/api/mission-control/stats` every ~30s. Have another tab create a test user (via the normal signup flow) and confirm the `usersTotal` count increments on the hub without reload.

- [ ] **Step 3: Commit**

```bash
git add src/components/mission-control/HubStatsClient.tsx src/app/mission-control/page.tsx
git commit -m "feat(mission-control): live-poll hub stats every 30s"
```

---

### Task 5.2: Browser-tab badge for new activity

**Files:**
- Modify: `src/components/mission-control/HubStatsClient.tsx`

Update `document.title` when counts change so a minimized tab shows `(3) Mission Control` style.

- [ ] **Step 1: Implement**

Inside `HubStatsClient`, after setting stats:

```ts
useEffect(() => {
  const pending = stats.newsDraftsPending + stats.reviewsFlagged;
  document.title = pending > 0 ? `(${pending}) Mission Control` : "Mission Control";
  return () => {
    document.title = "Mission Control";
  };
}, [stats.newsDraftsPending, stats.reviewsFlagged]);
```

- [ ] **Step 2: Verify in browser**

Flag a review manually, wait 30s, confirm tab title updates.

- [ ] **Step 3: Commit**

```bash
git add src/components/mission-control/HubStatsClient.tsx
git commit -m "feat(mission-control): badge pending count in document title"
```

---

### Task 5.3: Sign-out link

**Files:**
- Create: `src/app/mission-control/logout/route.ts`
- Modify: `src/components/mission-control/MCSidebar.tsx` — add sign-out link at bottom

- [ ] **Step 1: Implement logout route**

```ts
// src/app/mission-control/logout/route.ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MC_COOKIE } from "@/lib/mission-control/auth";

export async function GET() {
  const store = await cookies();
  store.delete(MC_COOKIE);
  return NextResponse.redirect(new URL("/mission-control/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
```

Update the proxy `/mission-control/*` auth check to allow `/mission-control/logout` (similar to how login is allowed).

- [ ] **Step 2: Add link to sidebar**

```tsx
// at the bottom of MCSidebar
<div className="mt-6 border-t border-slate-800 pt-4">
  <Link href="/mission-control/logout" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-100">
    <LogOut className="h-4 w-4" />
    Sign out
  </Link>
</div>
```

(Add `import { LogOut } from "lucide-react";`)

- [ ] **Step 3: Update proxy**

Edit `src/proxy.ts` line 116 to also allow `/mission-control/logout`:

```ts
if (pathname.startsWith("/mission-control") &&
    pathname !== "/mission-control/login" &&
    pathname !== "/mission-control/logout") {
```

- [ ] **Step 4: Verify in browser**

Click Sign out → cookie cleared → redirected to login page.

- [ ] **Step 5: Commit**

```bash
git add src/app/mission-control/logout src/components/mission-control/MCSidebar.tsx src/proxy.ts
git commit -m "feat(mission-control): add sign-out link"
```

---

### Task 5.4: End-to-end smoke test in browser

No new files — full walkthrough with `preview_*` tools.

- [ ] **Step 1: Start dev server**

Run `preview_start` if not already running.

- [ ] **Step 2: Walk the full flow**

1. Visit `/mission-control` unauthenticated → redirected to `/mission-control/login`.
2. Enter password → redirected to `/mission-control` hub with sidebar + 5 cards + 2 feeds.
3. Click each sidebar link: news-drafts, syncs, users, reviews, marketing — each renders its page with the shared sidebar visible.
4. On Users, search by email → filtered results. Click a user → detail page. Change role → revalidates.
5. On Reviews, click Flag on a review → status updates. Switch to Flagged tab → review appears. Click Restore → back to published.
6. Sign out → redirected to login. Try visiting `/mission-control/users` directly → bounced to login.

- [ ] **Step 3: Capture screenshot of hub**

Run `preview_screenshot` on the hub page for the PR description.

- [ ] **Step 4: Final commit (if any fixes needed from smoke test)**

```bash
git add -A
git commit -m "fix(mission-control): smoke-test corrections"
```

---

### Task 5.5: Type + lint + test sweep

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run build to catch type errors**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: no new warnings in mission-control files.

- [ ] **Step 4: Fix any issues, commit**

```bash
git add -A
git commit -m "chore(mission-control): fix type/lint issues from final sweep"
```

---

## Post-implementation checklist

- [ ] `/mission-control` renders hub with 5 cards + 2 feeds; stats update every 30s.
- [ ] `/profile/mission-control` and `/profile/mission-control/marketing` are deleted and unreferenced (`grep -r "profile/mission-control" src/` returns empty).
- [ ] News drafts still work exactly as before (no regressions).
- [ ] Syncs page renders all health info from the old `/profile/mission-control` page.
- [ ] Marketing page renders all tabs as before.
- [ ] Users: list, search, detail, ban/unban, delete, role change, impersonate link all functional.
- [ ] Reviews: flag/remove/restore all functional; tabs filter correctly.
- [ ] Sign-out clears cookie and redirects.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.

---

## Notes & gotchas

1. **Next 16 middleware is `src/proxy.ts`** (not `middleware.ts`). The proxy already gates `/mission-control/*`; do not create a duplicate.
2. **Service role key** is required for `auth.admin.*` calls. `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be set in every environment.
3. **Supabase ban via `ban_duration`**: the documented API uses string durations like `"876000h"` not a date. If you find the current SDK version rejects this, check `@supabase/supabase-js@2.49.1` docs — some versions accept `banned_until: ISO string` directly via a raw update to `auth.users`.
4. **Impersonation**: the simplest safe path is a magic link. A more advanced version would swap session cookies directly; that's out of scope here.
5. **Reviews user_id is nullable** (scraped reviews have no user). The page must handle null `user_id` by showing `reviewer_name` and skipping the user-profile link.
6. **RLS** is enabled on `user_profiles` with no policies — service role bypasses RLS, so mission-control queries work, but client-side queries from the public app will (correctly) fail. Do not remove RLS.
7. **Login route group** `(unauthenticated)` is used so the login page skips the hub chrome. Verify it still resolves at `/mission-control/login`, not at `/mission-control/(unauthenticated)/login`.
8. **`reviews.status` column already exists** (see `src/components/building/DeferredBuildingFAQ.tsx:46` and `src/app/api/checklist/route.ts`). Task 1.1 adds a defensive migration to (a) ensure `updated_at` is present and (b) replace any existing CHECK constraint with one that permits `'draft' | 'published' | 'flagged' | 'removed'`. If a prior CHECK didn't include `'flagged'`/`'removed'`, moderation would silently fail — this migration eliminates that risk.
9. **Known trade-off: user search is page-scoped.** Supabase `auth.admin.listUsers()` has no email-search parameter. `listUsers({ search })` filters in memory within the current page. The UI surfaces a yellow caveat line when a search is active. Upgrade path: create a security-definer view or RPC that joins `auth.users.email` for server-side search.
10. **Known trade-off: reviewer emails are fetched one-by-one.** Acceptable at the default 50-review page size for single-operator moderation. Upgrade path: a `reviewer_emails` view or batched RPC.
11. **`total` is NOT on the `listUsers` response.** `usersTotal` comes from `user_profiles` count via `getHubStats()`. The users list page shows `hasMore` (from page size heuristic) for pagination.

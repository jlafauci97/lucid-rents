interface SearchParams {
  next?: string;
  error?: string;
}

export const dynamic = "force-dynamic";

export default async function MissionControlLogin({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { next, error } = await searchParams;
  const nextPath = next && next.startsWith("/mission-control") ? next : "/mission-control";

  return (
    <main className="min-h-screen bg-[#0F1D2E] flex items-center justify-center p-6 text-white">
      <div className="w-full max-w-sm">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 text-xs tracking-[0.18em] uppercase text-[#60a5fa]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa]" />
            Mission Control
          </div>
          <h1 className="text-3xl font-bold mt-3">Restricted area</h1>
          <p className="text-sm text-[#93a4bf] mt-2">
            Enter the password to continue.
          </p>
        </header>
        <form
          action="/api/mission-control/login"
          method="post"
          className="space-y-4"
        >
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="sr-only">Password</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-[#60a5fa] focus:bg-white/8"
            />
          </label>
          {error && (
            <p className="text-sm text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg px-3 py-2">
              Incorrect password.
            </p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] font-semibold transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </main>
  );
}

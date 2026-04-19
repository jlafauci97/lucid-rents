import Link from "next/link";

// Root 404 boundary. Without this file, Next.js renders a fallback UI
// but returns HTTP 200 (soft-404). Declaring src/app/not-found.tsx
// restores the real 404 status code for every notFound() call in the app.
export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-[#3B82F6] mb-3">
          404
        </p>
        <h1 className="text-3xl font-bold text-[#0F1D2E] mb-3">Page not found</h1>
        <p className="text-[#64748b] mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-[#0F1D2E] text-white font-medium rounded-lg hover:bg-[#3B82F6] transition"
          >
            Go home
          </Link>
          <Link
            href="/nyc/search"
            className="inline-block px-5 py-2.5 border border-[#e2e8f0] text-[#0F1D2E] font-medium rounded-lg hover:border-[#0F1D2E] transition"
          >
            Search buildings
          </Link>
        </div>
      </div>
    </main>
  );
}

export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || `${singular}s`);
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

export function normalizeAddress(address: string): string {
  return address
    .trim()
    .toUpperCase()
    .replace(/\bST\b/g, "STREET")
    .replace(/\bAVE?\b/g, "AVENUE")
    .replace(/\bBLVD\b/g, "BOULEVARD")
    .replace(/\bPL\b/g, "PLACE")
    .replace(/\bDR\b/g, "DRIVE")
    .replace(/\bRD\b/g, "ROAD")
    .replace(/\bCT\b/g, "COURT")
    .replace(/\bLN\b/g, "LANE")
    .replace(/\bPKWY\b/g, "PARKWAY")
    .replace(/\s+/g, " ");
}

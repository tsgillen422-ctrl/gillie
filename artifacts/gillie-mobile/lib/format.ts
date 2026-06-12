/**
 * Shared formatting + asset-resolution helpers for the mobile app.
 */

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

/**
 * Resolve a (possibly relative) asset/avatar URL coming from the API into an
 * absolute URL the native Image component can load. Mirrors the web app's
 * resolveAvatarUrl logic, but prefixes the API base for relative paths.
 */
export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  if (url.startsWith("/api/storage")) return `${API_BASE}${url}`;
  if (url.startsWith("/objects/") || url.startsWith("/public-objects/")) {
    return `${API_BASE}/api/storage${url}`;
  }
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  return url;
}

/** Compact relative time, e.g. "now", "5m", "3h", "2d", "Mar 4". */
export function timeAgo(value?: string | number | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  const ms = Date.now() - date.getTime();
  if (Number.isNaN(ms)) return "";
  const sec = Math.round(ms / 1000);
  if (sec < 45) return "now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.round(day / 7);
  if (day < 30) return `${week}w`;
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Longer human date, e.g. "March 4, 2026". */
export function formatDate(value?: string | number | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return (
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

/** Deterministic HSL color from a string (for avatar fallbacks). */
export function colorFromString(str?: string | null): string {
  const s = str || "";
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

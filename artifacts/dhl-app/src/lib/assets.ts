/**
 * Resolve a stored image URL to one that loads in both dev and production.
 *
 * Static seed assets live in the app's public dir and must be served relative
 * to the app base, which differs between environments (`/` in dev, `/dhl-app/`
 * in the built app). Seed rows store paths like `/dhl-app/seed/x.png`, so we
 * re-anchor anything containing `/seed/` to the current BASE_URL. All other
 * URLs (object storage `/api/...`, absolute http, data URIs) pass through.
 */
export function resolveImageSrc(url?: string | null): string {
  if (!url) return "";
  const seedIdx = url.indexOf("/seed/");
  if (seedIdx >= 0) {
    return import.meta.env.BASE_URL.replace(/\/$/, "") + url.slice(seedIdx);
  }
  return url;
}

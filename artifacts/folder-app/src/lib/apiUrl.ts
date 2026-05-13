const _ext = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");

/**
 * Returns the correct absolute-or-relative URL for a given API path.
 *
 * - On Replit (dev + production): uses BASE_URL so requests stay on the
 *   same origin and hit the Express server through the shared proxy.
 * - On Cloudflare Pages: uses VITE_API_URL (set as an env var in the
 *   Cloudflare Pages project) pointing to the deployed Replit backend.
 *
 * Usage:  fetch(getApiUrl("api/folders/1"))
 */
export function getApiUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  if (_ext) return `${_ext}/${p}`;
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}/${p}`;
}

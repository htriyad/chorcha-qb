const _ext = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");

/**
 * Returns the correct URL for a given API path.
 *
 * - On Replit (dev): BASE_URL keeps requests on the same origin → hits
 *   the Express server through Replit's shared proxy.
 * - On Cloudflare Pages: VITE_API_URL (set as env var in the CF Pages project)
 *   points to the deployed Replit backend.
 *
 * Usage:  fetch(getApiUrl("api/chorcha/decode"))
 */
export function getApiUrl(path: string): string {
  const p = path.replace(/^\/+/, "");
  if (_ext) return `${_ext}/${p}`;
  const base = import.meta.env.BASE_URL.replace(/\/+$/, "");
  return `${base}/${p}`;
}

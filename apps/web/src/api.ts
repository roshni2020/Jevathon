/** Empty by default: requests go to /api and Vite proxies them to the backend in dev.
 *  Set VITE_API_URL to point the frontend at a backend on another origin. */
const BASE = import.meta.env.VITE_API_URL ?? "";
export const api = (path: string) => `${BASE}${path}`;

/** Every call carries the session cookie, including cross-origin. */
export async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(api(path), {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `${res.status}`);
  return res.json() as Promise<T>;
}

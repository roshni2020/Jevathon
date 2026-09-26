/** Empty by default: requests go to /api and Vite proxies them to the backend in dev.
 *  Set VITE_API_URL to point the frontend at a backend on another origin. */
const BASE = import.meta.env.VITE_API_URL ?? "";
export const api = (path: string) => `${BASE}${path}`;

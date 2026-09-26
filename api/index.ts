/**
 * Vercel entrypoint. Imports the PRECOMPILED server, not the TypeScript source:
 * tsx compiles at request time and its esbuild binary is not available in the
 * function runtime, so the server is built to dist/ by the build command instead.
 *
 * Guardian keeps sessions, verdicts and connections in process memory, so a cold
 * start loses them and concurrent instances do not share them. SSE cannot be held
 * open here either, so the dashboard polls. Both go away once store.ts is backed
 * by Postgres. Docker is the deployment that behaves exactly like local.
 */
export { default } from "../dist/apps/api/server.js";

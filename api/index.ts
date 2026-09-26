/**
 * Vercel entrypoint. The Express app is imported as a handler rather than binding a port.
 *
 * Caveat, and it is a real one: Guardian keeps sessions, verdicts and connections in
 * process memory, so a cold start loses them and concurrent instances do not share them.
 * SSE does not survive serverless either, so the dashboard falls back to polling.
 * Durable deployment needs the Postgres swap described in the README.
 */
export { default } from "../apps/api/server.js";

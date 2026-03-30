/**
 * Redis key names and cache TTL values (in seconds).
 * Single source of truth — used by workers and API routes.
 */

export const REDIS_KEYS = {
  FLIGHTS_LIVE: "flights:live",
  FLIGHTS_UPDATED_AT: "flights:updated_at",
  FLIGHTS_STALE: "flights:stale",
  FLIGHT_DETAIL: (id: string) => `flights:detail:${id}`,
  STATS_GLOBAL: "stats:global",
  STATS_REGION: (region: string) => `stats:region:${region}`,
  ANOMALIES_CURRENT: "anomalies:current",
  AIRPORT_FLIGHTS: (icao: string) => `airport:flights:${icao}`,
  AI_SKY: (region: string, bucket: string) => `ai:sky:${region}:${bucket}`,
  AI_FLIGHT: (id: string) => `ai:flight:${id}`,
  RATE_LIMIT_AI: (ip: string) => `ratelimit:ai:${ip}`,
  API_CALLS_TODAY: "api:calls:today",
  BROWSER_ACTIVE: "browser:active",
  POLL_FAILURES: "poll:failures",
} as const;

export const CACHE_TTL = {
  FLIGHTS_LIVE: 30,
  FLIGHT_DETAIL: 60,
  STATS: 60,
  ANOMALIES: 60,
  AI_SUMMARY: 300,
  AI_FLIGHT: 600,
  RATE_LIMIT: 60,
  BROWSER_ACTIVE: 120,
} as const;

export const POLL_INTERVAL_MS = 15_000;
export const STATS_INTERVAL_MS = 60_000;
export const CLIENT_REFETCH_MS = 10_000;
export const CLIENT_STATS_REFETCH_MS = 30_000;

import type { GlobalStats, Region } from "@skylens/types";
import { REDIS_KEYS } from "@skylens/lib";
import { redis } from "../db/redis";

export async function getStats(region?: Region): Promise<GlobalStats> {
  // Try region-specific stats first, fall back to global
  const key =
    region && region !== "global"
      ? REDIS_KEYS.STATS_REGION(region)
      : REDIS_KEYS.STATS_GLOBAL;

  const raw = await redis.get(key);

  if (raw) {
    return JSON.parse(raw) as GlobalStats;
  }

  // Fallback: return empty stats
  return {
    total_flights: 0,
    flights_in_region: null,
    busiest_airports: [],
    busiest_routes: [],
    anomalies: [],
    updated_at: new Date().toISOString(),
  };
}

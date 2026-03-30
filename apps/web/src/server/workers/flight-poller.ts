import type { FlightPosition } from "@skylens/types";
import type { FlightDataProvider } from "../providers/provider.interface";
import { AviationStackProvider } from "../providers/aviation-stack";
import { OpenSkyProvider } from "../providers/opensky";
import { redis } from "../db/redis";
import { prisma } from "../db/prisma";
import { REDIS_KEYS, CACHE_TTL, POLL_INTERVAL_MS } from "@skylens/lib";
import { detectAnomalies } from "../services/anomaly.service";

let provider: FlightDataProvider;
let failureCount = 0;
let pollCount = 0;
let polling = false;
let pgWriteFailures = 0;

function getProvider(): FlightDataProvider {
  if (!provider) {
    const apiKey = process.env.AVIATIONSTACK_API_KEY;
    if (!apiKey) {
      // Fall back to OpenSky (free, no key required)
      console.log("[poller] No AVIATIONSTACK_API_KEY — using OpenSky Network");
      provider = new OpenSkyProvider({
        username: process.env.OPENSKY_USERNAME,
        password: process.env.OPENSKY_PASSWORD,
      });
      return provider;
    }
    provider = new AviationStackProvider(apiKey);
  }
  return provider;
}

async function poll(): Promise<void> {
  // Prevent overlapping polls if a previous one is still running
  if (polling) return;
  polling = true;
  try {
    // Skip if data is still fresh (prevents double-fetch on restart)
    const lastUpdate = await redis.get(REDIS_KEYS.FLIGHTS_UPDATED_AT);
    if (lastUpdate) {
      const age = Date.now() - new Date(lastUpdate).getTime();
      if (age < POLL_INTERVAL_MS - 3_000) return;
    }

    const flights = await getProvider().fetchLiveFlights();
    const now = new Date().toISOString();

    // Write to Redis
    await redis.setex(REDIS_KEYS.FLIGHTS_LIVE, CACHE_TTL.FLIGHTS_LIVE, JSON.stringify(flights));
    await redis.setex(REDIS_KEYS.FLIGHTS_UPDATED_AT, CACHE_TTL.FLIGHTS_LIVE, now);
    await redis.del(REDIS_KEYS.FLIGHTS_STALE);

    // Write to Postgres (async, non-blocking)
    prisma.flightSnapshot
      .createMany({
        data: flights.map((f) => ({
          flightId: f.id,
          callsign: f.callsign,
          airlineIcao: f.airline,
          aircraftIcao: f.aircraft,
          originIcao: f.origin?.icao ?? null,
          destIcao: f.destination?.icao ?? null,
          latitude: f.position.latitude,
          longitude: f.position.longitude,
          altitudeFt: f.position.altitude_ft,
          heading: f.position.heading,
          speedKts: f.position.speed_kts,
          verticalRate: f.position.vertical_rate,
          onGround: f.position.on_ground,
          squawk: f.squawk,
          status: f.status,
        })),
        skipDuplicates: true,
      })
      .then(() => { pgWriteFailures = 0; })
      .catch((err) => {
        pgWriteFailures++;
        console.error(`[poller] Postgres write failed (${pgWriteFailures} consecutive):`, err);
        if (pgWriteFailures >= 10) {
          console.error("[poller] CRITICAL: Postgres writes failing persistently. Check connection/schema.");
        }
      });

    failureCount = 0;
    pollCount++;

    // Compute stats + anomalies every 4th cycle (~60s)
    if (pollCount % 4 === 0) {
      await computeAndCacheStats(flights);
      await detectAnomalies(flights);
    }
  } catch (err) {
    failureCount++;
    console.error(`[poller] Fetch failed (attempt ${failureCount}):`, err);

    if (failureCount >= 3) {
      await redis.set(REDIS_KEYS.FLIGHTS_STALE, "true");
    }
  } finally {
    polling = false;
  }
}

async function computeAndCacheStats(flights: FlightPosition[]): Promise<void> {
  // Count per airport
  const airportCounts = new Map<string, { name: string; count: number }>();
  const routeCounts = new Map<string, { origin: string; destination: string; count: number }>();

  for (const f of flights) {
    if (f.origin?.icao) {
      const entry = airportCounts.get(f.origin.icao) ?? { name: f.origin.name, count: 0 };
      entry.count++;
      airportCounts.set(f.origin.icao, entry);
    }
    if (f.destination?.icao) {
      const entry = airportCounts.get(f.destination.icao) ?? { name: f.destination.name, count: 0 };
      entry.count++;
      airportCounts.set(f.destination.icao, entry);
    }
    if (f.origin?.icao && f.destination?.icao) {
      const key = `${f.origin.icao}-${f.destination.icao}`;
      const entry = routeCounts.get(key) ?? { origin: f.origin.icao, destination: f.destination.icao, count: 0 };
      entry.count++;
      routeCounts.set(key, entry);
    }
  }

  const stats = {
    total_flights: flights.length,
    flights_in_region: null,
    busiest_airports: [...airportCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([icao, data]) => ({ icao, name: data.name, count: data.count })),
    busiest_routes: [...routeCounts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    anomalies: [],
    updated_at: new Date().toISOString(),
  };

  await redis.setex(REDIS_KEYS.STATS_GLOBAL, CACHE_TTL.STATS, JSON.stringify(stats));
}

export function startFlightPoller(): void {
  console.log(`[poller] Starting flight poller (interval: ${POLL_INTERVAL_MS}ms)`);
  poll(); // Immediate first poll
  setInterval(poll, POLL_INTERVAL_MS);
}

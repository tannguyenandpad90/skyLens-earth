import type { Anomaly, FlightPosition } from "@skylens/types";
import { REDIS_KEYS, CACHE_TTL } from "@skylens/lib";
import { redis } from "../db/redis";
import { prisma } from "../db/prisma";

/**
 * Simple anomaly detection: compare current flight count per airport
 * to the historical hourly average. Flag if > 1.5x or < 0.3x.
 */
export async function detectAnomalies(flights: FlightPosition[]): Promise<Anomaly[]> {
  const now = new Date();
  const hourUtc = now.getUTCHours();
  const dayOfWeek = (now.getUTCDay() + 6) % 7; // 0=Mon

  // Count flights per airport (origin + destination)
  const counts = new Map<string, number>();
  for (const f of flights) {
    if (f.origin?.icao) counts.set(f.origin.icao, (counts.get(f.origin.icao) ?? 0) + 1);
    if (f.destination?.icao) counts.set(f.destination.icao, (counts.get(f.destination.icao) ?? 0) + 1);
  }

  // Get baselines from Postgres
  const topAirports = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([icao]) => icao);

  if (topAirports.length === 0) return [];

  const baselines = await prisma.hourlyStat.findMany({
    where: {
      airportIcao: { in: topAirports },
      hourUtc: hourUtc,
      dayOfWeek: dayOfWeek,
    },
  });

  const baselineMap = new Map(baselines.map((b) => [b.airportIcao, b]));

  const anomalies: Anomaly[] = [];

  for (const [icao, count] of counts) {
    const baseline = baselineMap.get(icao);
    if (!baseline || baseline.sampleCount < 3) continue;

    const factor = count / baseline.avgFlights;

    if (factor > 1.5) {
      anomalies.push({
        airport_icao: icao,
        type: "high_traffic",
        factor: Math.round(factor * 10) / 10,
        message: `${icao} is at ${factor.toFixed(1)}x normal volume for this time`,
      });
    } else if (factor < 0.3 && baseline.avgFlights > 10) {
      anomalies.push({
        airport_icao: icao,
        type: "low_traffic",
        factor: Math.round(factor * 10) / 10,
        message: `${icao} is unusually quiet — ${(factor * 100).toFixed(0)}% of normal`,
      });
    }
  }

  // Cache anomalies
  await redis.setex(
    REDIS_KEYS.ANOMALIES_CURRENT,
    CACHE_TTL.ANOMALIES,
    JSON.stringify(anomalies),
  );

  return anomalies;
}

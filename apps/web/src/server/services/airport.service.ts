import type { AirportSummary, AirportDetail } from "@skylens/types";
import { prisma } from "../db/prisma";
import { redis } from "../db/redis";
import { REDIS_KEYS } from "@skylens/lib";

export async function searchAirports(query: string): Promise<AirportSummary[]> {
  const airports = await prisma.airport.findMany({
    where: {
      OR: [
        { icaoCode: { startsWith: query.toUpperCase() } },
        { iataCode: { startsWith: query.toUpperCase() } },
        { name: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
      ],
    },
    take: 10,
  });

  return airports.map((a) => ({
    icao: a.icaoCode,
    iata: a.iataCode,
    name: a.name,
    city: a.city,
    country: a.country,
    latitude: a.latitude,
    longitude: a.longitude,
    active_flights: 0, // Enriched later from Redis
  }));
}

export async function getAirportDetail(icao: string): Promise<AirportDetail | null> {
  const airport = await prisma.airport.findUnique({
    where: { icaoCode: icao.toUpperCase() },
  });

  if (!airport) return null;

  // Get current flight counts from Redis
  const flightData = await redis.get(REDIS_KEYS.AIRPORT_FLIGHTS(icao));
  const stats = flightData
    ? (JSON.parse(flightData) as { departures: number; arrivals: number; on_ground: number })
    : { departures: 0, arrivals: 0, on_ground: 0 };

  // Get anomaly if any
  const anomaliesRaw = await redis.get(REDIS_KEYS.ANOMALIES_CURRENT);
  const anomalies = anomaliesRaw ? JSON.parse(anomaliesRaw) : [];
  const anomaly = anomalies.find(
    (a: { airport_icao: string }) => a.airport_icao === icao,
  ) ?? null;

  return {
    icao: airport.icaoCode,
    iata: airport.iataCode,
    name: airport.name,
    city: airport.city,
    country: airport.country,
    latitude: airport.latitude,
    longitude: airport.longitude,
    active_flights: stats.departures + stats.arrivals,
    stats,
    anomaly,
  };
}

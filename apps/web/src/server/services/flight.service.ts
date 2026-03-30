import type { BoundingBox, FlightPosition, FlightDetail } from "@skylens/types";
import { REDIS_KEYS } from "@skylens/lib";
import { isInBounds } from "@skylens/lib";
import { redis } from "../db/redis";
import { prisma } from "../db/prisma";

export async function getLiveFlights(bounds?: BoundingBox): Promise<{
  flights: FlightPosition[];
  count: number;
  updated_at: string;
}> {
  const raw = await redis.get(REDIS_KEYS.FLIGHTS_LIVE);
  const updatedAt = (await redis.get(REDIS_KEYS.FLIGHTS_UPDATED_AT)) ?? new Date().toISOString();

  if (!raw) {
    return { flights: [], count: 0, updated_at: updatedAt };
  }

  let flights = JSON.parse(raw) as FlightPosition[];

  if (bounds) {
    flights = flights.filter((f) =>
      isInBounds(
        { latitude: f.position.latitude, longitude: f.position.longitude },
        bounds,
      ),
    );
  }

  return {
    flights,
    count: flights.length,
    updated_at: updatedAt,
  };
}

export async function getFlightDetail(id: string): Promise<FlightDetail | null> {
  // Check Redis cache
  const cached = await redis.get(REDIS_KEYS.FLIGHT_DETAIL(id));
  if (cached) return JSON.parse(cached) as FlightDetail;

  // Fetch latest snapshot from Postgres
  const snapshots = await prisma.flightSnapshot.findMany({
    where: { flightId: id },
    orderBy: { capturedAt: "desc" },
    take: 20,
  });

  if (snapshots.length === 0) return null;

  const latest = snapshots[0]!;

  const detail: FlightDetail = {
    id: latest.flightId,
    callsign: latest.callsign,
    airline: latest.airlineIcao,
    aircraft: latest.aircraftIcao,
    origin: latest.originIcao ? { icao: latest.originIcao, name: "" } : null,
    destination: latest.destIcao ? { icao: latest.destIcao, name: "" } : null,
    position: {
      latitude: latest.latitude,
      longitude: latest.longitude,
      altitude_ft: latest.altitudeFt,
      heading: latest.heading,
      speed_kts: latest.speedKts,
      vertical_rate: latest.verticalRate,
      on_ground: latest.onGround,
    },
    status: (latest.status as FlightDetail["status"]) ?? "unknown",
    squawk: latest.squawk,
    aircraft_detail: null,
    origin_detail: null,
    destination_detail: null,
    trail: snapshots.map((s) => ({
      lat: s.latitude,
      lng: s.longitude,
      alt: s.altitudeFt,
      ts: s.capturedAt.toISOString(),
    })),
  };

  return detail;
}

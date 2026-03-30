"use client";

import { useMemo } from "react";
import type { NormalizedFlight } from "@/server/providers/opensky";

/**
 * Converts NormalizedFlight[] into a GeoJSON FeatureCollection
 * with all properties needed by the map layers.
 *
 * Memoized to prevent re-serialization on every render.
 */
export function useFlightGeoJSON(flights: NormalizedFlight[]) {
  return useMemo((): GeoJSON.FeatureCollection<GeoJSON.Point> => {
    return {
      type: "FeatureCollection",
      features: flights.map((f) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [f.lon, f.lat],
        },
        properties: {
          id: f.id,
          callsign: f.callsign ?? "",
          altitudeFt: f.altitudeFt ?? 0,
          groundSpeedKt: f.groundSpeedKt ?? 0,
          headingDeg: f.headingDeg ?? 0,
          originIata: f.originIata ?? "",
          destinationIata: f.destinationIata ?? "",
          onGround: (f.altitudeFt ?? 0) < 100,
          timestamp: f.timestamp,
        },
      })),
    };
  }, [flights]);
}

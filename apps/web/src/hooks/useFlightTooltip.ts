"use client";

import { useState, useCallback } from "react";
import type { MapLayerMouseEvent } from "react-map-gl";

export interface FlightTooltipData {
  x: number;
  y: number;
  callsign: string;
  altitudeFt: number;
  groundSpeedKt: number;
  headingDeg: number;
  originIata: string;
  destinationIata: string;
}

/**
 * Manages hover state for flight tooltips.
 * Returns the tooltip data and Mapbox event handlers to wire up.
 *
 * Only shows tooltip for individual flights, not clusters.
 */
export function useFlightTooltip(interactiveLayerIds: string[]) {
  const [tooltip, setTooltip] = useState<FlightTooltipData | null>(null);

  const handleMouseEnter = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (!feature?.properties) return;

      // Skip clusters — they don't have flight-level properties
      if (feature.properties.cluster) {
        evt.target.getCanvas().style.cursor = "pointer";
        return;
      }

      // Skip if this isn't an individual flight (no id property)
      if (!feature.properties.id) return;

      const p = feature.properties;
      setTooltip({
        x: evt.point.x,
        y: evt.point.y,
        callsign: (p.callsign as string) || "",
        altitudeFt: (p.altitudeFt as number) || 0,
        groundSpeedKt: (p.groundSpeedKt as number) || 0,
        headingDeg: (p.headingDeg as number) || 0,
        originIata: (p.originIata as string) || "",
        destinationIata: (p.destinationIata as string) || "",
      });

      evt.target.getCanvas().style.cursor = "pointer";
    },
    [],
  );

  const handleMouseLeave = useCallback(
    (evt: MapLayerMouseEvent) => {
      setTooltip(null);
      evt.target.getCanvas().style.cursor = "";
    },
    [],
  );

  return {
    tooltip,
    interactiveLayerIds,
    handleMouseEnter,
    handleMouseLeave,
  };
}

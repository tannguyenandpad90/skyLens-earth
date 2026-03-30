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
 */
export function useFlightTooltip(interactiveLayerIds: string[]) {
  const [tooltip, setTooltip] = useState<FlightTooltipData | null>(null);

  const handleMouseEnter = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (!feature?.properties) return;

      const p = feature.properties;
      setTooltip({
        x: evt.point.x,
        y: evt.point.y,
        callsign: p.callsign as string,
        altitudeFt: p.altitudeFt as number,
        groundSpeedKt: p.groundSpeedKt as number,
        headingDeg: p.headingDeg as number,
        originIata: p.originIata as string,
        destinationIata: p.destinationIata as string,
      });

      // Change cursor
      const canvas = evt.target.getCanvas();
      canvas.style.cursor = "pointer";
    },
    [],
  );

  const handleMouseLeave = useCallback(
    (evt: MapLayerMouseEvent) => {
      setTooltip(null);
      const canvas = evt.target.getCanvas();
      canvas.style.cursor = "";
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

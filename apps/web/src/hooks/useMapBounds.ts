"use client";

import { useCallback, useRef } from "react";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl";
import { useUIStore } from "@/stores/ui-store";
import { viewportToBounds } from "@/lib/map-utils";

/**
 * Manages map ref and syncs viewport bounds to the global store.
 * Extracted so the map component stays thin.
 */
export function useMapBounds() {
  const mapRef = useRef<MapRef>(null);
  const setMapBounds = useUIStore((s) => s.setMapBounds);

  const syncBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    setMapBounds(
      viewportToBounds([
        [b.getWest(), b.getSouth()],
        [b.getEast(), b.getNorth()],
      ]),
    );
  }, [setMapBounds]);

  const handleMoveEnd = useCallback(
    (_evt: ViewStateChangeEvent) => {
      syncBounds();
    },
    [syncBounds],
  );

  return { mapRef, handleMoveEnd, syncBounds };
}

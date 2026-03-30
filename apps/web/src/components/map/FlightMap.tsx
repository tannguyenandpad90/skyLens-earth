"use client";

import { useCallback, useEffect } from "react";
import Map, { Source } from "react-map-gl";
import type { MapLayerMouseEvent } from "react-map-gl";
import type mapboxgl from "mapbox-gl";
import type { NormalizedFlight } from "@/server/providers/opensky";
import { useFlights } from "@/hooks/useFlights";
import { useUIStore } from "@/stores/ui-store";
import { useMapBounds } from "@/hooks/useMapBounds";
import { useFlightGeoJSON } from "@/hooks/useFlightGeoJSON";
import { useFlightTooltip } from "@/hooks/useFlightTooltip";
import { useAircraftImage } from "@/hooks/useAircraftImage";
import {
  ClusterCircleLayer,
  ClusterCountLayer,
  FlightIconLayer,
  FlightLabelLayer,
} from "./MapLayers";
import { FlightTooltip } from "./FlightTooltip";
import { AltitudeLegend } from "./AltitudeLegend";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INITIAL_VIEW = {
  longitude: 10,
  latitude: 40,
  zoom: 3,
  pitch: 0,
  bearing: 0,
};

const INTERACTIVE_LAYERS = ["flight-icons", "cluster-circles"];

// --- Cluster source config ---
const CLUSTER_OPTIONS = {
  cluster: true,
  clusterMaxZoom: 10,
  clusterRadius: 60,
  clusterMinPoints: 8,
} as const;

// --- Component ---

export function FlightMap() {
  const bounds = useUIStore((s) => s.mapBounds);
  const selectFlight = useUIStore((s) => s.selectFlight);

  // Hooks
  const { mapRef, handleMoveEnd, syncBounds } = useMapBounds();
  const { data } = useFlights(bounds);
  const { imageId, onMapLoad } = useAircraftImage();
  const { tooltip, handleMouseEnter, handleMouseLeave } = useFlightTooltip(INTERACTIVE_LAYERS);

  // Normalize FlightPosition[] → NormalizedFlight[] for the GeoJSON hook
  const flights: NormalizedFlight[] = (data?.flights ?? []).map((f) => ({
    id: f.id,
    lat: f.position.latitude,
    lon: f.position.longitude,
    altitudeFt: f.position.altitude_ft ?? undefined,
    groundSpeedKt: f.position.speed_kts ?? undefined,
    headingDeg: f.position.heading ?? undefined,
    callsign: f.callsign ?? undefined,
    originIata: f.origin?.icao ?? undefined,
    destinationIata: f.destination?.icao ?? undefined,
    timestamp: data?.updated_at ?? new Date().toISOString(),
  }));

  const geojson = useFlightGeoJSON(flights);

  // Load aircraft icon once map is ready
  useEffect(() => {
    onMapLoad(mapRef.current);
  }, [onMapLoad, mapRef]);

  // Handle map load — sync bounds on first render
  const handleLoad = useCallback(() => {
    onMapLoad(mapRef.current);
    syncBounds();
  }, [onMapLoad, mapRef, syncBounds]);

  // Click handler — select individual flights or expand clusters
  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (!feature) {
        selectFlight(null);
        return;
      }

      // Click on cluster → zoom into it
      if (feature.properties?.cluster) {
        const map = mapRef.current?.getMap();
        if (!map) return;
        const source = map.getSource("flights") as mapboxgl.GeoJSONSource | undefined;
        if (!source) return;

        const clusterId = feature.properties.cluster_id as number;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return;
          const coords = (feature.geometry as GeoJSON.Point).coordinates;
          map.easeTo({
            center: [coords[0]!, coords[1]!],
            zoom: zoom + 1,
            duration: 500,
          });
        });
        return;
      }

      // Click on individual flight
      if (feature.properties?.id) {
        selectFlight(feature.properties.id as string);
      } else {
        selectFlight(null);
      }
    },
    [selectFlight, mapRef],
  );

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        onLoad={handleLoad}
        onMoveEnd={handleMoveEnd}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        interactiveLayerIds={INTERACTIVE_LAYERS}
        attributionControl={false}
        reuseMaps
      >
        <Source
          id="flights"
          type="geojson"
          data={geojson}
          {...CLUSTER_OPTIONS}
        >
          {/* Render order: bottom → top */}
          <ClusterCircleLayer />
          <ClusterCountLayer />
          <FlightIconLayer imageId={imageId} />
          <FlightLabelLayer />
        </Source>
      </Map>

      {/* Tooltip overlay */}
      {tooltip && <FlightTooltip data={tooltip} />}

      {/* Altitude legend */}
      <AltitudeLegend />

      {/* Flight count badge */}
      <div className="absolute bottom-6 left-4 z-10 rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1 text-xs text-slate-400 backdrop-blur-sm">
        {flights.length > 0 ? (
          <>
            <span className="font-mono font-bold text-slate-200">
              {flights.length.toLocaleString()}
            </span>{" "}
            flights in view
          </>
        ) : (
          "Loading flights..."
        )}
      </div>
    </div>
  );
}

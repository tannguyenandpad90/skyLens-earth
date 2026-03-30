"use client";

import { useCallback, useRef } from "react";
import Map, { Layer, Source } from "react-map-gl";
import type { MapRef, ViewStateChangeEvent, MapLayerMouseEvent } from "react-map-gl";
import { useFlights } from "@/hooks/useFlights";
import { useUIStore } from "@/stores/ui-store";
import { viewportToBounds } from "@/lib/map-utils";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const INITIAL_VIEW = {
  longitude: 0,
  latitude: 30,
  zoom: 2.5,
  pitch: 0,
  bearing: 0,
};

export function FlightMap() {
  const mapRef = useRef<MapRef>(null);
  const bounds = useUIStore((s) => s.mapBounds);
  const setMapBounds = useUIStore((s) => s.setMapBounds);
  const selectFlight = useUIStore((s) => s.selectFlight);
  const { data } = useFlights(bounds);

  const geojson: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features:
      data?.flights.map((f) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [f.position.longitude, f.position.latitude],
        },
        properties: {
          id: f.id,
          callsign: f.callsign,
          altitude: f.position.altitude_ft,
          heading: f.position.heading ?? 0,
          onGround: f.position.on_ground,
        },
      })) ?? [],
  };

  const handleMoveEnd = useCallback(
    (evt: ViewStateChangeEvent) => {
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
    },
    [setMapBounds],
  );

  const handleClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (feature?.properties?.id) {
        selectFlight(feature.properties.id as string);
      } else {
        selectFlight(null);
      }
    },
    [selectFlight],
  );

  return (
    <Map
      ref={mapRef}
      initialViewState={INITIAL_VIEW}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      mapboxAccessToken={MAPBOX_TOKEN}
      onMoveEnd={handleMoveEnd}
      onClick={handleClick}
      interactiveLayerIds={["flights-layer"]}
    >
      <Source id="flights" type="geojson" data={geojson}>
        <Layer
          id="flights-layer"
          type="circle"
          paint={{
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2, 2,
              5, 4,
              10, 8,
            ],
            "circle-color": [
              "case",
              ["get", "onGround"],
              "#64748b",
              [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "altitude"], 0],
                0, "#22d3ee",
                15000, "#3b82f6",
                35000, "#a78bfa",
                45000, "#f472b6",
              ],
            ],
            "circle-opacity": 0.85,
          }}
        />
      </Source>
    </Map>
  );
}

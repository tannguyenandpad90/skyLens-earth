"use client";

import { Layer } from "react-map-gl";

/**
 * All Mapbox style layers for the flight map.
 * Separated from the map component for readability.
 *
 * Layer stack (bottom to top):
 * 1. cluster-circles  — aggregated circles when zoomed out
 * 2. cluster-count    — text label showing count inside clusters
 * 3. flight-icons     — individual aircraft icons with rotation
 * 4. flight-labels    — callsign labels at high zoom
 */

const ALTITUDE_COLOR_RAMP = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "altitudeFt"], 0],
  0,      "#22d3ee", // cyan — ground level
  10000,  "#3b82f6", // blue
  25000,  "#8b5cf6", // violet
  35000,  "#a78bfa", // purple
  45000,  "#f472b6", // pink — flight levels
] as const;

// --- Cluster layers ---

export function ClusterCircleLayer() {
  return (
    <Layer
      id="cluster-circles"
      type="circle"
      filter={["has", "point_count"]}
      paint={{
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#3b82f6",   // < 50: blue
          50,
          "#8b5cf6",   // 50-200: violet
          200,
          "#ec4899",   // 200-1000: pink
          1000,
          "#f43f5e",   // 1000+: red
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          18,     // < 50
          50, 24, // 50-200
          200, 32, // 200-1000
          1000, 40, // 1000+
        ],
        "circle-opacity": 0.75,
        "circle-stroke-width": 2,
        "circle-stroke-color": "rgba(255, 255, 255, 0.15)",
      }}
    />
  );
}

export function ClusterCountLayer() {
  return (
    <Layer
      id="cluster-count"
      type="symbol"
      filter={["has", "point_count"]}
      layout={{
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 13,
        "text-allow-overlap": true,
      }}
      paint={{
        "text-color": "#ffffff",
      }}
    />
  );
}

// --- Individual flight layers ---

export function FlightIconLayer({ imageId }: { imageId: string }) {
  return (
    <Layer
      id="flight-icons"
      type="symbol"
      filter={["!", ["has", "point_count"]]}
      layout={{
        "icon-image": imageId,
        "icon-size": [
          "interpolate",
          ["linear"],
          ["zoom"],
          2, 0.4,
          5, 0.6,
          8, 0.85,
          12, 1.0,
        ],
        "icon-rotate": ["get", "headingDeg"],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      }}
      paint={{
        "icon-color": ALTITUDE_COLOR_RAMP as unknown as string,
        "icon-opacity": [
          "case",
          ["get", "onGround"],
          0.4,
          0.9,
        ],
      }}
    />
  );
}

export function FlightLabelLayer() {
  return (
    <Layer
      id="flight-labels"
      type="symbol"
      filter={[
        "all",
        ["!", ["has", "point_count"]],
        ["!=", ["get", "callsign"], ""],
      ]}
      minzoom={7}
      layout={{
        "text-field": ["get", "callsign"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": 11,
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-optional": true,
      }}
      paint={{
        "text-color": "#94a3b8",
        "text-halo-color": "rgba(15, 23, 42, 0.8)",
        "text-halo-width": 1.5,
      }}
    />
  );
}

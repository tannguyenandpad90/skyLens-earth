"use client";

import { useCallback, useRef } from "react";
import type { MapRef } from "react-map-gl";

const AIRCRAFT_IMAGE_ID = "aircraft-icon";
const ICON_SIZE = 48;

/**
 * Loads a custom aircraft icon into the Mapbox style as an SDF image.
 * SDF (Signed Distance Field) allows runtime coloring via `icon-color`.
 * The icon is a chevron pointing north (0°); Mapbox rotates it via `icon-rotate`.
 */
export function useAircraftImage() {
  const loadedRef = useRef(false);

  const onMapLoad = useCallback((mapRef: MapRef | null) => {
    if (!mapRef || loadedRef.current) return;
    const map = mapRef.getMap();

    if (map.hasImage(AIRCRAFT_IMAGE_ID)) {
      loadedRef.current = true;
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

    // SDF images must be white — Mapbox recolors at render time
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";

    const cx = ICON_SIZE / 2;

    // Aircraft chevron shape pointing UP (north)
    ctx.beginPath();
    ctx.moveTo(cx, 4);                   // Nose tip
    ctx.lineTo(ICON_SIZE - 6, ICON_SIZE - 10); // Right wing tip
    ctx.lineTo(cx, ICON_SIZE - 18);       // Tail center indent
    ctx.lineTo(6, ICON_SIZE - 10);        // Left wing tip
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const imageData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
    map.addImage(AIRCRAFT_IMAGE_ID, imageData, { sdf: true });
    loadedRef.current = true;
  }, []);

  return { imageId: AIRCRAFT_IMAGE_ID, onMapLoad };
}

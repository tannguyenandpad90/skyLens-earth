import type { BoundingBox, Position } from "@skylens/types";

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

export function isInBounds(pos: Position, bounds: BoundingBox): boolean {
  const latOk = pos.latitude >= bounds.south && pos.latitude <= bounds.north;
  if (!latOk) return false;

  if (bounds.west <= bounds.east) {
    return pos.longitude >= bounds.west && pos.longitude <= bounds.east;
  }
  // Wraps antimeridian
  return pos.longitude >= bounds.west || pos.longitude <= bounds.east;
}

export function distanceKm(a: Position, b: Position): number {
  const dLat = (b.latitude - a.latitude) * DEG_TO_RAD;
  const dLon = (b.longitude - a.longitude) * DEG_TO_RAD;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.latitude * DEG_TO_RAD) *
      Math.cos(b.latitude * DEG_TO_RAD) *
      sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

export function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

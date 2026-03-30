import type { BoundingBox } from "@skylens/types";

/**
 * Convert a Mapbox viewport bounds array to our BoundingBox type.
 */
export function viewportToBounds(bounds: [[number, number], [number, number]]): BoundingBox {
  return {
    west: bounds[0][0],
    south: bounds[0][1],
    east: bounds[1][0],
    north: bounds[1][1],
  };
}

/**
 * Encode bounding box as query string params.
 */
export function boundsToQuery(bounds: BoundingBox): string {
  return `bounds=${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
}

/**
 * Get a rotation angle for an aircraft icon from heading degrees.
 * Mapbox rotates clockwise from north, which matches heading convention.
 */
export function headingToRotation(heading: number | null): number {
  return heading ?? 0;
}

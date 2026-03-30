import type { Region } from "@skylens/types";
import { REGION_BOUNDS } from "@skylens/types";
import { isInBounds } from "./geo";

const REGION_ORDER: Region[] = [
  "north_america",
  "europe",
  "asia",
  "south_america",
  "africa",
  "oceania",
];

export function regionFromCoords(lat: number, lng: number): Region {
  const pos = { latitude: lat, longitude: lng };
  for (const region of REGION_ORDER) {
    if (isInBounds(pos, REGION_BOUNDS[region])) return region;
  }
  return "global";
}

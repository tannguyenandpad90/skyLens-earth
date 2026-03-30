/**
 * OpenSky Network API response types and Zod schemas.
 *
 * API docs: https://openskynetwork.github.io/opensky-api/rest.html
 *
 * The /states/all endpoint returns a "states" array where each entry
 * is a positional tuple (not an object). Indices are fixed:
 *
 *   [0]  icao24          string   — ICAO 24-bit transponder address (hex)
 *   [1]  callsign        string?  — callsign (8 chars, may have trailing spaces)
 *   [2]  origin_country  string   — country of registration
 *   [3]  time_position   number?  — Unix timestamp of last position update
 *   [4]  last_contact     number  — Unix timestamp of last message received
 *   [5]  longitude       number?  — WGS-84 longitude in degrees
 *   [6]  latitude        number?  — WGS-84 latitude in degrees
 *   [7]  baro_altitude   number?  — barometric altitude in meters
 *   [8]  on_ground       boolean  — whether aircraft is on ground
 *   [9]  velocity         number?  — ground speed in m/s
 *   [10] true_track       number?  — heading in decimal degrees clockwise from north
 *   [11] vertical_rate    number?  — vertical rate in m/s (positive = climbing)
 *   [12] sensors          number[]? — IDs of receivers that contributed
 *   [13] geo_altitude     number?  — geometric altitude in meters
 *   [14] squawk           string?  — transponder code
 *   [15] spi              boolean  — Special Purpose Indicator
 *   [16] position_source  number   — 0=ADS-B, 1=ASTERIX, 2=MLAT, 3=FLARM
 *   [17] category         number   — aircraft category (optional, may be absent)
 */

import { z } from "zod";

// --- Raw API response schema ---

/**
 * Each state vector is a tuple of 17-18 elements.
 * We validate the structural shape and coerce nulls.
 */
export const OpenSkyStateVectorSchema = z
  .array(z.unknown())
  .refine((arr) => arr.length >= 17, {
    message: "State vector must have at least 17 elements",
  })
  .transform((arr) => ({
    icao24: asString(arr[0]),
    callsign: asNullableString(arr[1]),
    origin_country: asString(arr[2]),
    time_position: asNullableNumber(arr[3]),
    last_contact: asNumber(arr[4]),
    longitude: asNullableNumber(arr[5]),
    latitude: asNullableNumber(arr[6]),
    baro_altitude: asNullableNumber(arr[7]),
    on_ground: asBoolean(arr[8]),
    velocity: asNullableNumber(arr[9]),
    true_track: asNullableNumber(arr[10]),
    vertical_rate: asNullableNumber(arr[11]),
    sensors: arr[12] as number[] | null,
    geo_altitude: asNullableNumber(arr[13]),
    squawk: asNullableString(arr[14]),
    spi: asBoolean(arr[15]),
    position_source: asNumber(arr[16]),
  }));

export type OpenSkyStateVector = z.infer<typeof OpenSkyStateVectorSchema>;

export const OpenSkyResponseSchema = z.object({
  time: z.number(),
  states: z.array(OpenSkyStateVectorSchema).nullable(),
});

export type OpenSkyResponse = z.infer<typeof OpenSkyResponseSchema>;

// --- Coercion helpers (the API returns mixed types) ---

function asString(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}

function asNullableString(v: unknown): string | null {
  if (v == null) return null;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s.length > 0 ? s : null;
}

function asNullableNumber(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asBoolean(v: unknown): boolean {
  return v === true;
}

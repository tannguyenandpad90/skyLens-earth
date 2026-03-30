/**
 * Flight-level anomaly detection.
 *
 * Detects behavioral anomalies on individual flights by analyzing
 * a time-ordered sequence of NormalizedFlight snapshots.
 *
 * Three detectors:
 *   1. Holding pattern — aircraft circling in a small area with heading changes
 *   2. Sudden altitude drop — large altitude loss between consecutive snapshots
 *   3. Return to origin — aircraft heading back toward its departure airport
 *
 * Each detector is a pure function: (snapshots) → FlightAnomaly | null
 * This makes them independently testable and easy to reason about.
 */

import type { NormalizedFlight } from "../providers/opensky";

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export type AnomalySeverity = "low" | "medium" | "high";

export interface FlightAnomaly {
  flightId: string;
  type: string;
  severity: AnomalySeverity;
  description: string;
}

// ---------------------------------------------------------------------------
// Thresholds (tunable constants)
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  /** Holding pattern: max distance (km) between any two points in the window. */
  HOLDING_MAX_RADIUS_KM: 20,
  /** Holding pattern: minimum number of heading reversals to qualify. */
  HOLDING_MIN_REVERSALS: 3,
  /** Holding pattern: minimum number of snapshots needed. */
  HOLDING_MIN_SNAPSHOTS: 5,

  /** Altitude drop: feet lost between two consecutive snapshots for "medium". */
  ALTITUDE_DROP_MEDIUM_FT: 3_000,
  /** Altitude drop: feet lost between two consecutive snapshots for "high". */
  ALTITUDE_DROP_HIGH_FT: 8_000,
  /** Altitude drop: ignore drops when aircraft is below this altitude (landing). */
  ALTITUDE_DROP_FLOOR_FT: 2_000,

  /** Return to origin: max distance (km) to origin to trigger. */
  RETURN_MAX_DISTANCE_KM: 50,
  /** Return to origin: min distance (km) the flight must have traveled away first. */
  RETURN_MIN_DEPARTURE_KM: 100,
  /** Return to origin: minimum snapshots before checking. */
  RETURN_MIN_SNAPSHOTS: 4,
} as const;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze a time-ordered sequence of snapshots for a single flight.
 * Returns all detected anomalies (may be 0, 1, or multiple).
 *
 * @param snapshots - Chronologically ordered snapshots (oldest first).
 *                    All must share the same flight ID.
 */
export function detectFlightAnomalies(
  snapshots: NormalizedFlight[],
): FlightAnomaly[] {
  if (snapshots.length < 2) return [];

  const flightId = snapshots[0]!.id;
  const anomalies: FlightAnomaly[] = [];

  const holding = detectHoldingPattern(flightId, snapshots);
  if (holding) anomalies.push(holding);

  const drop = detectAltitudeDrop(flightId, snapshots);
  if (drop) anomalies.push(drop);

  const returnToOrigin = detectReturnToOrigin(flightId, snapshots);
  if (returnToOrigin) anomalies.push(returnToOrigin);

  return anomalies;
}

/**
 * Batch analysis: group snapshots by flight ID, then detect anomalies on each.
 * Useful when processing a mixed array of snapshots from multiple flights.
 */
export function detectAnomaliesBatch(
  allSnapshots: NormalizedFlight[],
): FlightAnomaly[] {
  const byFlight = new Map<string, NormalizedFlight[]>();

  for (const snap of allSnapshots) {
    const existing = byFlight.get(snap.id);
    if (existing) {
      existing.push(snap);
    } else {
      byFlight.set(snap.id, [snap]);
    }
  }

  const anomalies: FlightAnomaly[] = [];

  for (const snapshots of byFlight.values()) {
    // Sort by timestamp (oldest first)
    snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    anomalies.push(...detectFlightAnomalies(snapshots));
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Detector 1: Holding pattern
// ---------------------------------------------------------------------------

/**
 * A holding pattern is detected when:
 * - The aircraft stays within a small geographic area (< 20km radius)
 * - The heading changes direction (reversal) at least 3 times
 *
 * This catches racetrack patterns, orbits, and ATC-directed holds.
 *
 * How heading reversals are counted:
 *   Track the sign of heading delta between consecutive snapshots.
 *   Each time the sign flips (clockwise → counter-clockwise or vice versa),
 *   that's one reversal. A straight flight has 0 reversals.
 *   A single 360° orbit has ~2 reversals. A hold has 3+.
 */
export function detectHoldingPattern(
  flightId: string,
  snapshots: NormalizedFlight[],
): FlightAnomaly | null {
  if (snapshots.length < THRESHOLDS.HOLDING_MIN_SNAPSHOTS) return null;

  // Check geographic spread — all points must be within the radius
  if (!isWithinRadius(snapshots, THRESHOLDS.HOLDING_MAX_RADIUS_KM)) return null;

  // Count heading reversals
  const reversals = countHeadingReversals(snapshots);
  if (reversals < THRESHOLDS.HOLDING_MIN_REVERSALS) return null;

  const severity: AnomalySeverity = reversals >= 6 ? "high" : reversals >= 4 ? "medium" : "low";

  return {
    flightId,
    type: "holding_pattern",
    severity,
    description:
      `Aircraft is circling in a ${THRESHOLDS.HOLDING_MAX_RADIUS_KM}km area ` +
      `with ${reversals} heading reversals over ${snapshots.length} observations. ` +
      `Possible holding pattern or ATC-directed orbit.`,
  };
}

// ---------------------------------------------------------------------------
// Detector 2: Sudden altitude drop
// ---------------------------------------------------------------------------

/**
 * A sudden altitude drop is detected when:
 * - Altitude decreases by more than the threshold between consecutive snapshots
 * - The aircraft was above the floor altitude (not just landing normally)
 *
 * We check every consecutive pair and report the worst drop.
 */
export function detectAltitudeDrop(
  flightId: string,
  snapshots: NormalizedFlight[],
): FlightAnomaly | null {
  let worstDrop = 0;
  let worstFromAlt = 0;
  let worstToAlt = 0;

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!;
    const curr = snapshots[i]!;

    const prevAlt = prev.altitudeFt;
    const currAlt = curr.altitudeFt;

    // Skip if either altitude is unknown
    if (prevAlt == null || currAlt == null) continue;
    // Skip if already low (normal descent/landing)
    if (prevAlt < THRESHOLDS.ALTITUDE_DROP_FLOOR_FT) continue;

    const drop = prevAlt - currAlt;
    if (drop > worstDrop) {
      worstDrop = drop;
      worstFromAlt = prevAlt;
      worstToAlt = currAlt;
    }
  }

  if (worstDrop < THRESHOLDS.ALTITUDE_DROP_MEDIUM_FT) return null;

  const severity: AnomalySeverity =
    worstDrop >= THRESHOLDS.ALTITUDE_DROP_HIGH_FT ? "high" : "medium";

  return {
    flightId,
    type: "altitude_drop",
    severity,
    description:
      `Aircraft dropped ${worstDrop.toLocaleString()} ft ` +
      `(from ${worstFromAlt.toLocaleString()} ft to ${worstToAlt.toLocaleString()} ft) ` +
      `between consecutive observations. ` +
      `${severity === "high" ? "Possible emergency descent." : "Unusual rate of descent."}`,
  };
}

// ---------------------------------------------------------------------------
// Detector 3: Return to origin
// ---------------------------------------------------------------------------

/**
 * A return-to-origin is detected when:
 * - The flight has an originIata
 * - It traveled at least 100km away from origin
 * - The latest snapshot is within 50km of origin
 *
 * We approximate origin position from the first snapshot
 * (since we don't have airport coordinates here).
 */
export function detectReturnToOrigin(
  flightId: string,
  snapshots: NormalizedFlight[],
): FlightAnomaly | null {
  if (snapshots.length < THRESHOLDS.RETURN_MIN_SNAPSHOTS) return null;

  const first = snapshots[0]!;
  const last = snapshots[snapshots.length - 1]!;

  // Must have an origin to compare against
  if (!first.originIata) return null;

  // Use first snapshot position as proxy for origin airport
  const origin = { latitude: first.lat, longitude: first.lon };

  // Find the maximum distance the aircraft reached from origin
  let maxDistFromOrigin = 0;
  for (const snap of snapshots) {
    const d = haversineKm(origin, { latitude: snap.lat, longitude: snap.lon });
    if (d > maxDistFromOrigin) maxDistFromOrigin = d;
  }

  // Must have traveled far enough to count as a "departure"
  if (maxDistFromOrigin < THRESHOLDS.RETURN_MIN_DEPARTURE_KM) return null;

  // Check if current position is close to origin
  const currentDist = haversineKm(origin, { latitude: last.lat, longitude: last.lon });
  if (currentDist > THRESHOLDS.RETURN_MAX_DISTANCE_KM) return null;

  const severity: AnomalySeverity =
    currentDist < 15 ? "high" : currentDist < 30 ? "medium" : "low";

  return {
    flightId,
    type: "return_to_origin",
    severity,
    description:
      `Aircraft departed ${first.originIata} and reached ${Math.round(maxDistFromOrigin)}km away, ` +
      `but is now only ${Math.round(currentDist)}km from its origin. ` +
      `Possible diversion or return to departure airport.`,
  };
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

interface LatLon {
  latitude: number;
  longitude: number;
}

function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLon = (b.longitude - a.longitude) * toRad;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h =
    sinLat * sinLat +
    Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * sinLon * sinLon;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Check if all snapshots fall within a circle of the given radius.
 * Uses the centroid of all points as the circle center.
 */
function isWithinRadius(snapshots: NormalizedFlight[], radiusKm: number): boolean {
  // Compute centroid
  let sumLat = 0;
  let sumLon = 0;
  for (const s of snapshots) {
    sumLat += s.lat;
    sumLon += s.lon;
  }
  const centroid: LatLon = {
    latitude: sumLat / snapshots.length,
    longitude: sumLon / snapshots.length,
  };

  // Check all points are within radius of centroid
  for (const s of snapshots) {
    const d = haversineKm(centroid, { latitude: s.lat, longitude: s.lon });
    if (d > radiusKm) return false;
  }

  return true;
}

/**
 * Count heading direction reversals.
 *
 * Computes the signed heading delta between consecutive snapshots,
 * normalized to [-180, +180]. Each time the sign of the delta flips,
 * it counts as a reversal.
 *
 * Example:
 *   Headings: 90° → 120° → 150° → 120° → 90° → 120°
 *   Deltas:       +30     +30     -30     -30     +30
 *   Signs:         +       +       -       -       +
 *   Reversals:                      1               2
 */
export function countHeadingReversals(snapshots: NormalizedFlight[]): number {
  if (snapshots.length < 3) return 0;

  let reversals = 0;
  let lastSign: number | null = null;

  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]!.headingDeg;
    const curr = snapshots[i]!.headingDeg;

    if (prev == null || curr == null) continue;

    const delta = normalizeAngleDelta(curr - prev);

    // Ignore tiny heading changes (< 5°) — GPS noise
    if (Math.abs(delta) < 5) continue;

    const sign = delta > 0 ? 1 : -1;

    if (lastSign !== null && sign !== lastSign) {
      reversals++;
    }

    lastSign = sign;
  }

  return reversals;
}

/**
 * Normalize an angle difference to the range [-180, +180].
 *
 *   normalizeAngleDelta(350)  →  -10  (350° right = 10° left)
 *   normalizeAngleDelta(-350) →   10
 *   normalizeAngleDelta(30)   →   30
 */
export function normalizeAngleDelta(delta: number): number {
  let d = delta % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

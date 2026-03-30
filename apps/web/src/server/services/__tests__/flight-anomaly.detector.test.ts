import { describe, it, expect } from "vitest";
import {
  detectFlightAnomalies,
  detectAnomaliesBatch,
  detectHoldingPattern,
  detectAltitudeDrop,
  detectReturnToOrigin,
  countHeadingReversals,
  normalizeAngleDelta,
  THRESHOLDS,
  type FlightAnomaly,
} from "../flight-anomaly.detector";
import type { NormalizedFlight } from "../../providers/opensky";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _ts = 1711800000000; // Base timestamp

function snap(overrides?: Partial<NormalizedFlight>): NormalizedFlight {
  _ts += 15_000; // 15s between snapshots
  return {
    id: "TEST001",
    lat: 50.0,
    lon: 8.5,
    altitudeFt: 35000,
    groundSpeedKt: 480,
    headingDeg: 90,
    callsign: "TST001",
    originIata: "FRA",
    destinationIata: "LHR",
    timestamp: new Date(_ts).toISOString(),
    ...overrides,
  };
}

function resetTimestamp() {
  _ts = 1711800000000;
}

// ---------------------------------------------------------------------------
// normalizeAngleDelta
// ---------------------------------------------------------------------------

describe("normalizeAngleDelta", () => {
  it("passes through small positive angles", () => {
    expect(normalizeAngleDelta(30)).toBe(30);
  });

  it("passes through small negative angles", () => {
    expect(normalizeAngleDelta(-30)).toBe(-30);
  });

  it("wraps 350° to -10°", () => {
    expect(normalizeAngleDelta(350)).toBe(-10);
  });

  it("wraps -350° to 10°", () => {
    expect(normalizeAngleDelta(-350)).toBe(10);
  });

  it("handles exactly 180°", () => {
    expect(normalizeAngleDelta(180)).toBe(180);
  });

  it("wraps 181° to -179°", () => {
    expect(normalizeAngleDelta(181)).toBe(-179);
  });

  it("handles 0°", () => {
    expect(normalizeAngleDelta(0)).toBe(0);
  });

  it("handles full rotation 360°", () => {
    expect(normalizeAngleDelta(360)).toBe(0);
  });

  it("handles 720°", () => {
    expect(normalizeAngleDelta(720)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countHeadingReversals
// ---------------------------------------------------------------------------

describe("countHeadingReversals", () => {
  beforeEach(resetTimestamp);

  it("returns 0 for fewer than 3 snapshots", () => {
    const result = countHeadingReversals([
      snap({ headingDeg: 90 }),
      snap({ headingDeg: 120 }),
    ]);
    expect(result).toBe(0);
  });

  it("returns 0 for a straight flight (constant heading change direction)", () => {
    // Steady right turn: 90° → 120° → 150° → 180° → 210°
    const result = countHeadingReversals([
      snap({ headingDeg: 90 }),
      snap({ headingDeg: 120 }),
      snap({ headingDeg: 150 }),
      snap({ headingDeg: 180 }),
      snap({ headingDeg: 210 }),
    ]);
    expect(result).toBe(0);
  });

  it("detects reversals in a zigzag pattern", () => {
    // Right → Left → Right → Left
    // 90→120 (+30), 120→80 (-40), 80→130 (+50), 130→70 (-60)
    const result = countHeadingReversals([
      snap({ headingDeg: 90 }),
      snap({ headingDeg: 120 }),
      snap({ headingDeg: 80 }),
      snap({ headingDeg: 130 }),
      snap({ headingDeg: 70 }),
    ]);
    expect(result).toBe(3);
  });

  it("ignores tiny heading changes (< 5°, GPS noise)", () => {
    // 90→92 (+2, ignored), 92→85 (-7), 85→90 (+5)
    const result = countHeadingReversals([
      snap({ headingDeg: 90 }),
      snap({ headingDeg: 92 }),  // < 5°, ignored
      snap({ headingDeg: 85 }),
      snap({ headingDeg: 90 }),
    ]);
    // Only one meaningful reversal: -7 → +5
    expect(result).toBe(1);
  });

  it("handles heading wrapping around 360°/0°", () => {
    // 350→10 (+20 via wrap), 10→340 (-30 via wrap), 340→20 (+40 via wrap)
    const result = countHeadingReversals([
      snap({ headingDeg: 350 }),
      snap({ headingDeg: 10 }),   // +20 (clockwise)
      snap({ headingDeg: 340 }),  // -30 (counter-clockwise)
      snap({ headingDeg: 20 }),   // +40 (clockwise)
    ]);
    expect(result).toBe(2);
  });

  it("skips snapshots with null headings", () => {
    const result = countHeadingReversals([
      snap({ headingDeg: 90 }),
      snap({ headingDeg: undefined }),  // null pair: skip i=1 (90→null) and i=2 (null→120)
      snap({ headingDeg: 120 }),
      snap({ headingDeg: 80 }),         // only delta computed: 120→80 (-40), single sign → 0 reversals
    ]);
    expect(result).toBe(0);
  });

  it("counts correctly for a racetrack holding pattern", () => {
    // Simulated oval: 90→120→150→180→150→120→90→60→30→60→90→120
    const headings = [90, 120, 150, 180, 150, 120, 90, 60, 30, 60, 90, 120];
    const snaps = headings.map((h) => snap({ headingDeg: h }));
    const result = countHeadingReversals(snaps);
    // +30,+30,+30,-30,-30,-30,-30,-30,+30,+30,+30 → 2 reversals
    expect(result).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// detectHoldingPattern
// ---------------------------------------------------------------------------

describe("detectHoldingPattern", () => {
  beforeEach(resetTimestamp);

  it("returns null for too few snapshots", () => {
    const snaps = [snap(), snap(), snap()];
    expect(detectHoldingPattern("F1", snaps)).toBeNull();
  });

  it("returns null for a straight flight (no reversals)", () => {
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, headingDeg: 90 }),
      snap({ lat: 50.0, lon: 8.01, headingDeg: 90 }),
      snap({ lat: 50.0, lon: 8.02, headingDeg: 90 }),
      snap({ lat: 50.0, lon: 8.03, headingDeg: 90 }),
      snap({ lat: 50.0, lon: 8.04, headingDeg: 90 }),
    ];
    expect(detectHoldingPattern("F1", snaps)).toBeNull();
  });

  it("returns null if aircraft is spread over too large an area", () => {
    // Points ~200km apart — not a hold
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, headingDeg: 90 }),
      snap({ lat: 50.0, lon: 10.0, headingDeg: 120 }),
      snap({ lat: 50.0, lon: 8.0, headingDeg: 270 }),
      snap({ lat: 50.0, lon: 10.0, headingDeg: 120 }),
      snap({ lat: 50.0, lon: 8.0, headingDeg: 270 }),
    ];
    expect(detectHoldingPattern("F1", snaps)).toBeNull();
  });

  it("detects a holding pattern (tight area + many reversals)", () => {
    // Aircraft circling within ~5km, heading oscillating
    const snaps = [
      snap({ lat: 50.00, lon: 8.00, headingDeg: 90 }),
      snap({ lat: 50.01, lon: 8.01, headingDeg: 180 }),
      snap({ lat: 50.00, lon: 8.02, headingDeg: 90 }),
      snap({ lat: 50.01, lon: 8.01, headingDeg: 180 }),
      snap({ lat: 50.00, lon: 8.00, headingDeg: 90 }),
      snap({ lat: 50.01, lon: 8.01, headingDeg: 180 }),
      snap({ lat: 50.00, lon: 8.02, headingDeg: 90 }),
    ];
    const result = detectHoldingPattern("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("holding_pattern");
    expect(result!.severity).toMatch(/low|medium|high/);
    expect(result!.description).toContain("heading reversals");
  });

  it("severity escalates with more reversals", () => {
    // Build a pattern with many reversals in a tiny area
    const headings = [0, 90, 0, 90, 0, 90, 0, 90, 0, 90, 0, 90, 0];
    const snaps = headings.map((h) =>
      snap({ lat: 50.0, lon: 8.0, headingDeg: h }),
    );

    const result = detectHoldingPattern("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high"); // 6+ reversals
  });
});

// ---------------------------------------------------------------------------
// detectAltitudeDrop
// ---------------------------------------------------------------------------

describe("detectAltitudeDrop", () => {
  beforeEach(resetTimestamp);

  it("returns null when no significant drop", () => {
    const snaps = [
      snap({ altitudeFt: 35000 }),
      snap({ altitudeFt: 34500 }),
      snap({ altitudeFt: 34000 }),
    ];
    expect(detectAltitudeDrop("F1", snaps)).toBeNull();
  });

  it("detects a medium altitude drop (>= 3000ft)", () => {
    const snaps = [
      snap({ altitudeFt: 35000 }),
      snap({ altitudeFt: 31000 }),
    ];
    const result = detectAltitudeDrop("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("altitude_drop");
    expect(result!.severity).toBe("medium");
    expect(result!.description).toContain("4,000 ft");
  });

  it("detects a high severity drop (>= 8000ft)", () => {
    const snaps = [
      snap({ altitudeFt: 35000 }),
      snap({ altitudeFt: 25000 }),
    ];
    const result = detectAltitudeDrop("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high");
    expect(result!.description).toContain("10,000 ft");
    expect(result!.description).toContain("emergency descent");
  });

  it("ignores drops from low altitude (normal landing)", () => {
    const snaps = [
      snap({ altitudeFt: 1500 }),  // Below floor
      snap({ altitudeFt: 0 }),
    ];
    expect(detectAltitudeDrop("F1", snaps)).toBeNull();
  });

  it("ignores altitude increases", () => {
    const snaps = [
      snap({ altitudeFt: 10000 }),
      snap({ altitudeFt: 35000 }),
    ];
    expect(detectAltitudeDrop("F1", snaps)).toBeNull();
  });

  it("skips snapshots with unknown altitude", () => {
    const snaps = [
      snap({ altitudeFt: 35000 }),
      snap({ altitudeFt: undefined }),
      snap({ altitudeFt: 35000 }),
    ];
    expect(detectAltitudeDrop("F1", snaps)).toBeNull();
  });

  it("reports the worst drop across all pairs", () => {
    const snaps = [
      snap({ altitudeFt: 35000 }),
      snap({ altitudeFt: 32000 }),  // -3000
      snap({ altitudeFt: 33000 }),  // +1000
      snap({ altitudeFt: 24000 }),  // -9000 ← worst
    ];
    const result = detectAltitudeDrop("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high");
    expect(result!.description).toContain("9,000 ft");
    expect(result!.description).toContain("from 33,000 ft to 24,000 ft");
  });

  it("handles exactly-at-threshold drops", () => {
    const snaps = [
      snap({ altitudeFt: 10000 }),
      snap({ altitudeFt: 10000 - THRESHOLDS.ALTITUDE_DROP_MEDIUM_FT }),
    ];
    const result = detectAltitudeDrop("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// detectReturnToOrigin
// ---------------------------------------------------------------------------

describe("detectReturnToOrigin", () => {
  beforeEach(resetTimestamp);

  it("returns null when no origin is set", () => {
    const snaps = [
      snap({ originIata: undefined, lat: 50.0, lon: 8.0 }),
      snap({ originIata: undefined, lat: 51.0, lon: 10.0 }),
      snap({ originIata: undefined, lat: 52.0, lon: 12.0 }),
      snap({ originIata: undefined, lat: 50.0, lon: 8.0 }),
    ];
    expect(detectReturnToOrigin("F1", snaps)).toBeNull();
  });

  it("returns null when aircraft never traveled far enough", () => {
    // All points within 50km of origin
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
      snap({ lat: 50.1, lon: 8.1, originIata: "FRA" }),
      snap({ lat: 50.2, lon: 8.2, originIata: "FRA" }),
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
    ];
    expect(detectReturnToOrigin("F1", snaps)).toBeNull();
  });

  it("returns null when aircraft is still far from origin", () => {
    // Traveled far and still far away
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
      snap({ lat: 52.0, lon: 12.0, originIata: "FRA" }),
      snap({ lat: 54.0, lon: 15.0, originIata: "FRA" }),
      snap({ lat: 55.0, lon: 18.0, originIata: "FRA" }),
    ];
    expect(detectReturnToOrigin("F1", snaps)).toBeNull();
  });

  it("detects return to origin", () => {
    // Depart FRA (50.0, 8.0), fly to ~52.0,12.0 (~300km), then return
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
      snap({ lat: 51.0, lon: 10.0, originIata: "FRA" }),
      snap({ lat: 52.0, lon: 12.0, originIata: "FRA" }),  // ~300km from origin
      snap({ lat: 51.0, lon: 10.0, originIata: "FRA" }),
      snap({ lat: 50.05, lon: 8.05, originIata: "FRA" }),  // ~6km from origin
    ];
    const result = detectReturnToOrigin("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("return_to_origin");
    expect(result!.description).toContain("FRA");
    expect(result!.description).toContain("diversion");
  });

  it("severity is high when very close to origin", () => {
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
      snap({ lat: 52.0, lon: 12.0, originIata: "FRA" }),
      snap({ lat: 54.0, lon: 15.0, originIata: "FRA" }),
      snap({ lat: 52.0, lon: 12.0, originIata: "FRA" }),
      snap({ lat: 50.001, lon: 8.001, originIata: "FRA" }),  // < 1km
    ];
    const result = detectReturnToOrigin("F1", snaps);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("high");
  });

  it("returns null with too few snapshots", () => {
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
      snap({ lat: 50.0, lon: 8.0, originIata: "FRA" }),
    ];
    expect(detectReturnToOrigin("F1", snaps)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectFlightAnomalies (combined)
// ---------------------------------------------------------------------------

describe("detectFlightAnomalies", () => {
  beforeEach(resetTimestamp);

  it("returns empty array for single snapshot", () => {
    expect(detectFlightAnomalies([snap()])).toEqual([]);
  });

  it("returns empty array for normal flight", () => {
    const snaps = [
      snap({ lat: 50.0, lon: 8.0, altitudeFt: 35000, headingDeg: 270 }),
      snap({ lat: 50.0, lon: 7.5, altitudeFt: 35000, headingDeg: 270 }),
      snap({ lat: 50.0, lon: 7.0, altitudeFt: 35000, headingDeg: 270 }),
      snap({ lat: 50.0, lon: 6.5, altitudeFt: 35000, headingDeg: 270 }),
      snap({ lat: 50.0, lon: 6.0, altitudeFt: 35000, headingDeg: 270 }),
    ];
    expect(detectFlightAnomalies(snaps)).toEqual([]);
  });

  it("can detect multiple anomaly types simultaneously", () => {
    // Aircraft in a tight area with heading changes AND an altitude drop
    const snaps = [
      snap({ lat: 50.00, lon: 8.00, altitudeFt: 35000, headingDeg: 90, originIata: "FRA" }),
      snap({ lat: 50.01, lon: 8.01, altitudeFt: 35000, headingDeg: 180, originIata: "FRA" }),
      snap({ lat: 50.00, lon: 8.00, altitudeFt: 35000, headingDeg: 90, originIata: "FRA" }),
      snap({ lat: 50.01, lon: 8.01, altitudeFt: 35000, headingDeg: 180, originIata: "FRA" }),
      snap({ lat: 50.00, lon: 8.00, altitudeFt: 25000, headingDeg: 90, originIata: "FRA" }),  // -10k drop
      snap({ lat: 50.01, lon: 8.01, altitudeFt: 25000, headingDeg: 180, originIata: "FRA" }),
      snap({ lat: 50.00, lon: 8.00, altitudeFt: 25000, headingDeg: 90, originIata: "FRA" }),
    ];

    const anomalies = detectFlightAnomalies(snaps);
    const types = anomalies.map((a) => a.type);

    expect(types).toContain("holding_pattern");
    expect(types).toContain("altitude_drop");
  });

  it("all anomalies reference the correct flight ID", () => {
    const snaps = [
      snap({ id: "ABCDEF", lat: 50.00, lon: 8.00, altitudeFt: 35000, headingDeg: 90 }),
      snap({ id: "ABCDEF", lat: 50.00, lon: 8.00, altitudeFt: 25000, headingDeg: 90 }),
    ];

    const anomalies = detectFlightAnomalies(snaps);
    for (const a of anomalies) {
      expect(a.flightId).toBe("ABCDEF");
    }
  });
});

// ---------------------------------------------------------------------------
// detectAnomaliesBatch
// ---------------------------------------------------------------------------

describe("detectAnomaliesBatch", () => {
  beforeEach(resetTimestamp);

  it("groups snapshots by flight ID and detects per-flight", () => {
    const snaps = [
      // Flight A — altitude drop
      snap({ id: "A", altitudeFt: 35000 }),
      snap({ id: "A", altitudeFt: 25000 }),
      // Flight B — normal
      snap({ id: "B", altitudeFt: 35000 }),
      snap({ id: "B", altitudeFt: 34900 }),
    ];

    const anomalies = detectAnomaliesBatch(snaps);

    expect(anomalies.length).toBe(1);
    expect(anomalies[0]!.flightId).toBe("A");
    expect(anomalies[0]!.type).toBe("altitude_drop");
  });

  it("handles empty input", () => {
    expect(detectAnomaliesBatch([])).toEqual([]);
  });

  it("handles multiple flights with anomalies", () => {
    const snaps = [
      // Flight A — altitude drop
      snap({ id: "A", altitudeFt: 35000 }),
      snap({ id: "A", altitudeFt: 25000 }),
      // Flight B — altitude drop
      snap({ id: "B", altitudeFt: 30000 }),
      snap({ id: "B", altitudeFt: 20000 }),
    ];

    const anomalies = detectAnomaliesBatch(snaps);
    expect(anomalies.length).toBe(2);
    expect(anomalies.map((a) => a.flightId).sort()).toEqual(["A", "B"]);
  });

  it("sorts snapshots by timestamp before detection", () => {
    // Snapshots arrive out of order
    const snaps = [
      { ...snap({ id: "A", altitudeFt: 25000 }), timestamp: "2026-03-30T14:01:00Z" },
      { ...snap({ id: "A", altitudeFt: 35000 }), timestamp: "2026-03-30T14:00:00Z" },
    ];

    const anomalies = detectAnomaliesBatch(snaps);
    // After sorting: 35000 → 25000 = drop
    expect(anomalies.length).toBe(1);
    expect(anomalies[0]!.type).toBe("altitude_drop");
  });
});

// ---------------------------------------------------------------------------
// Type safety checks
// ---------------------------------------------------------------------------

describe("type contracts", () => {
  beforeEach(resetTimestamp);

  it("FlightAnomaly has all required fields", () => {
    const snaps = [
      snap({ altitudeFt: 35000 }),
      snap({ altitudeFt: 25000 }),
    ];

    const anomalies = detectFlightAnomalies(snaps);
    expect(anomalies.length).toBeGreaterThan(0);

    const a: FlightAnomaly = anomalies[0]!;
    expect(typeof a.flightId).toBe("string");
    expect(typeof a.type).toBe("string");
    expect(["low", "medium", "high"]).toContain(a.severity);
    expect(typeof a.description).toBe("string");
    expect(a.description.length).toBeGreaterThan(0);
  });

  it("descriptions never contain 'undefined' or 'NaN'", () => {
    const snaps = [
      snap({ altitudeFt: 35000, headingDeg: undefined, originIata: undefined }),
      snap({ altitudeFt: 25000, headingDeg: undefined, originIata: undefined }),
    ];

    const anomalies = detectFlightAnomalies(snaps);
    for (const a of anomalies) {
      expect(a.description).not.toContain("undefined");
      expect(a.description).not.toContain("NaN");
    }
  });
});

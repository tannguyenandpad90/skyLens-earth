import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OpenSkyProvider,
  stateToNormalized,
  OpenSkyApiError,
  OpenSkyRateLimitError,
  OpenSkyValidationError,
  type NormalizedFlight,
} from "../opensky";
import { OpenSkyStateVectorSchema, OpenSkyResponseSchema } from "../opensky.types";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** A realistic state vector tuple as returned by the OpenSky /states/all API. */
function makeStateVector(overrides?: Partial<Record<string, unknown>>): unknown[] {
  const defaults: unknown[] = [
    "abc123",       // [0]  icao24
    "DLH1234 ",     // [1]  callsign (with trailing space)
    "Germany",      // [2]  origin_country
    1711800000,     // [3]  time_position (unix)
    1711800005,     // [4]  last_contact
    8.5706,         // [5]  longitude
    50.0333,        // [6]  latitude
    10668.0,        // [7]  baro_altitude (meters)
    false,          // [8]  on_ground
    257.0,          // [9]  velocity (m/s)
    45.0,           // [10] true_track (degrees)
    0.5,            // [11] vertical_rate (m/s)
    null,           // [12] sensors
    10700.0,        // [13] geo_altitude (meters)
    "1000",         // [14] squawk
    false,          // [15] spi
    0,              // [16] position_source
  ];

  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      const idx = Number(key);
      if (!isNaN(idx)) defaults[idx] = value;
    }
  }

  return defaults;
}

function makeApiResponse(states: unknown[][] | null = null) {
  return {
    time: 1711800010,
    states: states ?? [makeStateVector()],
  };
}

// ---------------------------------------------------------------------------
// Zod schema validation tests
// ---------------------------------------------------------------------------

describe("OpenSkyStateVectorSchema", () => {
  it("parses a valid state vector", () => {
    const result = OpenSkyStateVectorSchema.safeParse(makeStateVector());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.icao24).toBe("abc123");
    expect(result.data.callsign).toBe("DLH1234");
    expect(result.data.latitude).toBe(50.0333);
    expect(result.data.longitude).toBe(8.5706);
    expect(result.data.baro_altitude).toBe(10668.0);
    expect(result.data.on_ground).toBe(false);
    expect(result.data.velocity).toBe(257.0);
    expect(result.data.true_track).toBe(45.0);
  });

  it("handles null/missing position fields gracefully", () => {
    const vector = makeStateVector({ "5": null, "6": null, "7": null, "9": null, "10": null });
    const result = OpenSkyStateVectorSchema.safeParse(vector);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.longitude).toBeNull();
    expect(result.data.latitude).toBeNull();
    expect(result.data.baro_altitude).toBeNull();
    expect(result.data.velocity).toBeNull();
    expect(result.data.true_track).toBeNull();
  });

  it("trims trailing spaces from callsign", () => {
    const vector = makeStateVector({ "1": "UAL456  " });
    const result = OpenSkyStateVectorSchema.safeParse(vector);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.callsign).toBe("UAL456");
  });

  it("returns null callsign for empty/whitespace string", () => {
    const vector = makeStateVector({ "1": "   " });
    const result = OpenSkyStateVectorSchema.safeParse(vector);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.callsign).toBeNull();
  });

  it("returns null callsign for null value", () => {
    const vector = makeStateVector({ "1": null });
    const result = OpenSkyStateVectorSchema.safeParse(vector);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.callsign).toBeNull();
  });

  it("rejects a vector with fewer than 17 elements", () => {
    const short = makeStateVector().slice(0, 10);
    const result = OpenSkyStateVectorSchema.safeParse(short);
    expect(result.success).toBe(false);
  });

  it("accepts a vector with 18 elements (optional category field)", () => {
    const vector = [...makeStateVector(), 1]; // category = 1
    const result = OpenSkyStateVectorSchema.safeParse(vector);
    expect(result.success).toBe(true);
  });

  it("coerces on_ground non-true values to false", () => {
    const vector = makeStateVector({ "8": null });
    const result = OpenSkyStateVectorSchema.safeParse(vector);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.on_ground).toBe(false);
  });
});

describe("OpenSkyResponseSchema", () => {
  it("parses a valid response with states", () => {
    const result = OpenSkyResponseSchema.safeParse(makeApiResponse());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.time).toBe(1711800010);
    expect(result.data.states).toHaveLength(1);
  });

  it("parses a response with null states (no aircraft)", () => {
    const result = OpenSkyResponseSchema.safeParse({ time: 1711800010, states: null });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.states).toBeNull();
  });

  it("rejects a response missing the time field", () => {
    const result = OpenSkyResponseSchema.safeParse({ states: [] });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stateToNormalized transform tests
// ---------------------------------------------------------------------------

describe("stateToNormalized", () => {
  it("correctly converts a full state vector to NormalizedFlight", () => {
    const parsed = OpenSkyStateVectorSchema.parse(makeStateVector());
    const flight = stateToNormalized(parsed);

    expect(flight).toEqual<NormalizedFlight>({
      id: "abc123",
      lat: 50.0333,
      lon: 8.5706,
      altitudeFt: Math.round(10668 * 3.28084), // 35000
      groundSpeedKt: Math.round(257 * 1.94384), // 500
      headingDeg: 45.0,
      callsign: "DLH1234",
      originIata: undefined,
      destinationIata: undefined,
      timestamp: new Date(1711800000 * 1000).toISOString(),
    });
  });

  it("uses last_contact when time_position is null", () => {
    const parsed = OpenSkyStateVectorSchema.parse(
      makeStateVector({ "3": null }),
    );
    const flight = stateToNormalized(parsed);
    expect(flight.timestamp).toBe(new Date(1711800005 * 1000).toISOString());
  });

  it("handles completely null optional fields", () => {
    const parsed = OpenSkyStateVectorSchema.parse(
      makeStateVector({
        "1": null,   // callsign
        "7": null,   // baro_altitude
        "9": null,   // velocity
        "10": null,  // true_track
        "13": null,  // geo_altitude
      }),
    );
    const flight = stateToNormalized(parsed);

    expect(flight.callsign).toBeUndefined();
    expect(flight.altitudeFt).toBeUndefined();
    expect(flight.groundSpeedKt).toBeUndefined();
    expect(flight.headingDeg).toBeUndefined();
  });

  it("falls back to geo_altitude when baro_altitude is null", () => {
    const parsed = OpenSkyStateVectorSchema.parse(
      makeStateVector({ "7": null, "13": 5000.0 }),
    );
    const flight = stateToNormalized(parsed);
    expect(flight.altitudeFt).toBe(Math.round(5000 * 3.28084)); // 16404
  });

  it("latitude=0 and longitude=0 is preserved (filtered later)", () => {
    const parsed = OpenSkyStateVectorSchema.parse(
      makeStateVector({ "5": 0, "6": 0 }),
    );
    const flight = stateToNormalized(parsed);
    expect(flight.lat).toBe(0);
    expect(flight.lon).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// OpenSkyProvider integration tests (mocked fetch)
// ---------------------------------------------------------------------------

describe("OpenSkyProvider", () => {
  let provider: OpenSkyProvider;

  beforeEach(() => {
    provider = new OpenSkyProvider();
    vi.restoreAllMocks();
  });

  it("fetches, validates, and normalizes flights", async () => {
    const states = [
      makeStateVector(),
      makeStateVector({ "0": "def456", "1": "AAL789", "6": 40.6413, "5": -73.7781 }),
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse(states)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const flights = await provider.fetchAndNormalize();

    expect(flights).toHaveLength(2);
    expect(flights[0]!.id).toBe("abc123");
    expect(flights[0]!.callsign).toBe("DLH1234");
    expect(flights[1]!.id).toBe("def456");
    expect(flights[1]!.callsign).toBe("AAL789");
    expect(flights[1]!.lat).toBe(40.6413);
    expect(flights[1]!.lon).toBe(-73.7781);
  });

  it("filters out flights with (0,0) coordinates", async () => {
    const states = [
      makeStateVector(),
      makeStateVector({ "0": "ghost1", "5": 0, "6": 0 }),  // null island
      makeStateVector({ "0": "ghost2", "5": null, "6": null }),  // no position
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse(states)), { status: 200 }),
    );

    const flights = await provider.fetchAndNormalize();
    expect(flights).toHaveLength(1);
    expect(flights[0]!.id).toBe("abc123");
  });

  it("returns empty array when API returns null states", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ time: 1711800010, states: null }), { status: 200 }),
    );

    const flights = await provider.fetchAndNormalize();
    expect(flights).toEqual([]);
  });

  it("throws OpenSkyRateLimitError on 429", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Rate limited", { status: 429 }),
    );

    await expect(provider.fetchAndNormalize()).rejects.toThrow(OpenSkyRateLimitError);
  });

  it("throws OpenSkyApiError on 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Server error", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(provider.fetchAndNormalize()).rejects.toThrow(OpenSkyApiError);
  });

  it("throws OpenSkyValidationError on malformed JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ wrong: "shape" }), { status: 200 }),
    );

    await expect(provider.fetchAndNormalize()).rejects.toThrow(OpenSkyValidationError);
  });

  it("sends auth header when credentials are provided", async () => {
    const authProvider = new OpenSkyProvider({
      username: "testuser",
      password: "testpass",
    });

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse()), { status: 200 }),
    );

    await authProvider.fetchAndNormalize();

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(
      `Basic ${Buffer.from("testuser:testpass").toString("base64")}`,
    );
  });

  it("does not send auth header when no credentials", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse()), { status: 200 }),
    );

    await provider.fetchAndNormalize();

    const [, init] = fetchSpy.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
  });

  it("converts NormalizedFlight to FlightPosition via fetchLiveFlights", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse()), { status: 200 }),
    );

    const positions = await provider.fetchLiveFlights();

    expect(positions).toHaveLength(1);
    const pos = positions[0]!;

    // FlightPosition shape
    expect(pos.id).toContain("abc123");
    expect(pos.callsign).toBe("DLH1234");
    expect(pos.airline).toBe("DLH");
    expect(pos.position.latitude).toBe(50.0333);
    expect(pos.position.longitude).toBe(8.5706);
    expect(pos.position.altitude_ft).toBe(Math.round(10668 * 3.28084));
    expect(pos.position.speed_kts).toBe(500);
    expect(pos.position.heading).toBe(45.0);
    expect(pos.status).toBe("en-route");
  });

  it("infers 'landed' status for aircraft on ground", async () => {
    const states = [
      makeStateVector({ "7": 0, "9": 5.0 }), // altitude ~0ft, slow
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse(states)), { status: 200 }),
    );

    const positions = await provider.fetchLiveFlights();
    expect(positions[0]!.status).toBe("landed");
  });

  it("handles large datasets without error", async () => {
    const states = Array.from({ length: 5000 }, (_, i) =>
      makeStateVector({
        "0": `icao${i.toString().padStart(6, "0")}`,
        "6": -90 + (i / 5000) * 180,
        "5": -180 + (i / 5000) * 360,
      }),
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse(states)), { status: 200 }),
    );

    const flights = await provider.fetchAndNormalize();
    expect(flights.length).toBeGreaterThan(4900); // Most should pass validation
  });
});

// ---------------------------------------------------------------------------
// Edge case tests
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles state vector with negative altitude (below sea level)", () => {
    const parsed = OpenSkyStateVectorSchema.parse(
      makeStateVector({ "7": -100 }),
    );
    const flight = stateToNormalized(parsed);
    expect(flight.altitudeFt).toBe(Math.round(-100 * 3.28084));
  });

  it("handles state vector with extreme speed", () => {
    const parsed = OpenSkyStateVectorSchema.parse(
      makeStateVector({ "9": 700 }), // ~1360 knots (supersonic)
    );
    const flight = stateToNormalized(parsed);
    expect(flight.groundSpeedKt).toBe(Math.round(700 * 1.94384));
  });

  it("handles callsign with only 2 characters (no airline extracted)", async () => {
    const provider = new OpenSkyProvider();
    const states = [makeStateVector({ "1": "AB" })];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse(states)), { status: 200 }),
    );

    const positions = await provider.fetchLiveFlights();
    expect(positions[0]!.airline).toBeNull();
  });

  it("filters out flights with out-of-range latitude", async () => {
    const provider = new OpenSkyProvider();
    const states = [
      makeStateVector({ "0": "good1" }),
      makeStateVector({ "0": "bad1", "6": 91 }),   // invalid lat
      makeStateVector({ "0": "bad2", "6": -91 }),  // invalid lat
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(makeApiResponse(states)), { status: 200 }),
    );

    const flights = await provider.fetchAndNormalize();
    expect(flights).toHaveLength(1);
    expect(flights[0]!.id).toBe("good1");
  });
});

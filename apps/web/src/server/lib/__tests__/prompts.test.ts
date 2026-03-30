import { describe, it, expect } from "vitest";
import {
  buildSkySummaryPrompt,
  buildFlightExplainPrompt,
  buildFallbackSummary,
  SKY_SUMMARY_SYSTEM,
  FLIGHT_EXPLAIN_SYSTEM,
  type SkySummaryInput,
  type FlightExplainInput,
} from "../prompts";
import type { GlobalStats, FlightDetail } from "@skylens/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStats(overrides?: Partial<GlobalStats>): GlobalStats {
  return {
    total_flights: 12847,
    flights_in_region: 4231,
    busiest_airports: [
      { icao: "KATL", name: "Hartsfield-Jackson", count: 312 },
      { icao: "KDFW", name: "Dallas/Fort Worth", count: 287 },
      { icao: "KORD", name: "O'Hare", count: 264 },
    ],
    busiest_routes: [
      { origin: "KJFK", destination: "KLAX", count: 18 },
      { origin: "KATL", destination: "KLGA", count: 15 },
    ],
    anomalies: [],
    updated_at: "2026-03-30T14:00:00Z",
    ...overrides,
  };
}

function makeFlightDetail(overrides?: Partial<FlightDetail>): FlightDetail {
  return {
    id: "DLH1234-2026-03-30",
    callsign: "DLH1234",
    airline: "DLH",
    aircraft: "A320",
    origin: { icao: "EDDF", name: "Frankfurt" },
    destination: { icao: "EGLL", name: "Heathrow" },
    position: {
      latitude: 50.0,
      longitude: 5.0,
      altitude_ft: 35000,
      heading: 310,
      speed_kts: 480,
      vertical_rate: 0,
      on_ground: false,
    },
    status: "en-route",
    squawk: null,
    aircraft_detail: {
      icao: "A320",
      name: "Airbus A320-200",
      registration: "D-AIBC",
    },
    origin_detail: {
      icao: "EDDF",
      iata: "FRA",
      name: "Frankfurt Airport",
      city: "Frankfurt",
      country: "Germany",
      latitude: 50.033,
      longitude: 8.57,
      active_flights: 142,
    },
    destination_detail: {
      icao: "EGLL",
      iata: "LHR",
      name: "Heathrow Airport",
      city: "London",
      country: "UK",
      latitude: 51.47,
      longitude: -0.461,
      active_flights: 198,
    },
    trail: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

describe("system prompts", () => {
  it("SKY_SUMMARY_SYSTEM contains anti-hallucination rules", () => {
    expect(SKY_SUMMARY_SYSTEM).toContain("ONLY reference data explicitly provided");
    expect(SKY_SUMMARY_SYSTEM).toContain("Do not invent");
    expect(SKY_SUMMARY_SYSTEM).toContain("2-4 markdown bullet points");
  });

  it("FLIGHT_EXPLAIN_SYSTEM contains anti-hallucination rules", () => {
    expect(FLIGHT_EXPLAIN_SYSTEM).toContain("ONLY use the flight data provided");
    expect(FLIGHT_EXPLAIN_SYSTEM).toContain("Do not invent");
    expect(FLIGHT_EXPLAIN_SYSTEM).toContain("2-3 concise sentences");
  });
});

// ---------------------------------------------------------------------------
// buildSkySummaryPrompt
// ---------------------------------------------------------------------------

describe("buildSkySummaryPrompt", () => {
  it("includes all stats data in the prompt", () => {
    const input: SkySummaryInput = {
      region: "north america",
      stats: makeStats(),
      utcTime: "2026-03-30T14:00:00Z",
    };

    const prompt = buildSkySummaryPrompt(input);

    // Total flights
    expect(prompt).toContain("12,847");
    // Region
    expect(prompt).toContain("north america");
    // Airports
    expect(prompt).toContain("KATL Hartsfield-Jackson: 312 flights");
    expect(prompt).toContain("KDFW Dallas/Fort Worth: 287 flights");
    // Routes
    expect(prompt).toContain("KJFK → KLAX: 18 flights");
    // Anomalies
    expect(prompt).toContain("None");
    // Time
    expect(prompt).toContain("2026-03-30T14:00:00Z");
  });

  it("includes anomalies when present", () => {
    const stats = makeStats({
      anomalies: [
        {
          airport_icao: "EGLL",
          type: "high_traffic",
          factor: 1.8,
          message: "Heathrow is at 1.8x normal volume",
        },
      ],
    });

    const prompt = buildSkySummaryPrompt({
      region: "europe",
      stats,
      utcTime: "2026-03-30T14:00:00Z",
    });

    expect(prompt).toContain("[HIGH_TRAFFIC] EGLL");
    expect(prompt).toContain("1.8x normal");
    expect(prompt).not.toContain("None");
  });

  it("handles empty airports and routes gracefully", () => {
    const stats = makeStats({
      busiest_airports: [],
      busiest_routes: [],
    });

    const prompt = buildSkySummaryPrompt({
      region: "the world",
      stats,
      utcTime: "2026-03-30T14:00:00Z",
    });

    expect(prompt).toContain("No data");
    expect(prompt).not.toContain("undefined");
  });

  it("handles null flights_in_region", () => {
    const stats = makeStats({ flights_in_region: null });

    const prompt = buildSkySummaryPrompt({
      region: "global",
      stats,
      utcTime: "2026-03-30T14:00:00Z",
    });

    expect(prompt).toContain("N/A");
  });
});

// ---------------------------------------------------------------------------
// buildFlightExplainPrompt
// ---------------------------------------------------------------------------

describe("buildFlightExplainPrompt", () => {
  it("includes all flight data fields", () => {
    const input: FlightExplainInput = { flight: makeFlightDetail() };
    const prompt = buildFlightExplainPrompt(input);

    expect(prompt).toContain("DLH1234");
    expect(prompt).toContain("DLH");
    expect(prompt).toContain("EDDF");
    expect(prompt).toContain("Frankfurt Airport, Frankfurt");
    expect(prompt).toContain("EGLL");
    expect(prompt).toContain("Heathrow Airport, London");
    expect(prompt).toContain("Airbus A320-200 (A320, reg: D-AIBC)");
    expect(prompt).toContain("35,000 ft");
    expect(prompt).toContain("480 kts");
    expect(prompt).toContain("310°");
    expect(prompt).toContain("en-route");
  });

  it("handles missing origin and destination", () => {
    const flight = makeFlightDetail({
      origin: null,
      destination: null,
      origin_detail: null,
      destination_detail: null,
    });

    const prompt = buildFlightExplainPrompt({ flight });

    expect(prompt).toContain("Origin: Unknown");
    expect(prompt).toContain("Destination: Unknown");
  });

  it("handles missing aircraft detail", () => {
    const flight = makeFlightDetail({
      aircraft_detail: null,
      aircraft: "B738",
    });

    const prompt = buildFlightExplainPrompt({ flight });
    expect(prompt).toContain("Aircraft: B738");
  });

  it("handles fully unknown aircraft", () => {
    const flight = makeFlightDetail({
      aircraft_detail: null,
      aircraft: null,
    });

    const prompt = buildFlightExplainPrompt({ flight });
    expect(prompt).toContain("Aircraft: Unknown");
  });

  it("handles null altitude and speed", () => {
    const flight = makeFlightDetail({
      position: {
        ...makeFlightDetail().position,
        altitude_ft: null,
        speed_kts: null,
        heading: null,
        vertical_rate: null,
      },
    });

    const prompt = buildFlightExplainPrompt({ flight });

    expect(prompt).toContain("Altitude: N/A");
    expect(prompt).toContain("Ground speed: N/A");
    expect(prompt).toContain("Heading: N/A");
    expect(prompt).toContain("Vertical rate: N/A");
  });

  it("shows on_ground status", () => {
    const flight = makeFlightDetail({
      position: { ...makeFlightDetail().position, on_ground: true },
    });

    const prompt = buildFlightExplainPrompt({ flight });
    expect(prompt).toContain("On ground: Yes");
  });
});

// ---------------------------------------------------------------------------
// buildFallbackSummary
// ---------------------------------------------------------------------------

describe("buildFallbackSummary", () => {
  it("returns total flights and busiest airport", () => {
    const stats = makeStats();
    const fallback = buildFallbackSummary(stats);

    expect(fallback).toContain("12,847");
    expect(fallback).toContain("Hartsfield-Jackson");
    expect(fallback).toContain("312 active flights");
    expect(fallback).toContain("temporarily unavailable");
  });

  it("handles empty stats", () => {
    const stats = makeStats({
      total_flights: 0,
      busiest_airports: [],
      anomalies: [],
    });

    const fallback = buildFallbackSummary(stats);

    expect(fallback).toContain("0");
    expect(fallback).not.toContain("Busiest airport");
    expect(fallback).not.toContain("anomal");
  });

  it("includes anomaly count when anomalies exist", () => {
    const stats = makeStats({
      anomalies: [
        { airport_icao: "EGLL", type: "high_traffic", factor: 1.8, message: "test" },
        { airport_icao: "KJFK", type: "low_traffic", factor: 0.2, message: "test2" },
      ],
    });

    const fallback = buildFallbackSummary(stats);
    expect(fallback).toContain("**2** traffic anomalies detected");
  });

  it("uses singular 'anomaly' for count of 1", () => {
    const stats = makeStats({
      anomalies: [
        { airport_icao: "EGLL", type: "high_traffic", factor: 1.8, message: "test" },
      ],
    });

    const fallback = buildFallbackSummary(stats);
    expect(fallback).toContain("**1** traffic anomaly detected");
  });
});

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

describe("prompt structure", () => {
  it("sky summary prompt has clear data delimiters", () => {
    const prompt = buildSkySummaryPrompt({
      region: "test",
      stats: makeStats(),
      utcTime: "2026-03-30T14:00:00Z",
    });

    expect(prompt).toContain("=== AIR TRAFFIC DATA ===");
    expect(prompt).toContain("========================");
  });

  it("flight explain prompt has clear data delimiters", () => {
    const prompt = buildFlightExplainPrompt({ flight: makeFlightDetail() });

    expect(prompt).toContain("=== FLIGHT DATA ===");
    expect(prompt).toContain("===================");
  });

  it("prompts never contain 'undefined' or 'null' as text", () => {
    // Test with maximally empty data
    const emptyStats = makeStats({
      total_flights: 0,
      flights_in_region: null,
      busiest_airports: [],
      busiest_routes: [],
      anomalies: [],
    });

    const skyPrompt = buildSkySummaryPrompt({
      region: "global",
      stats: emptyStats,
      utcTime: "2026-03-30T14:00:00Z",
    });

    const emptyFlight = makeFlightDetail({
      callsign: null,
      airline: null,
      aircraft: null,
      aircraft_detail: null,
      origin: null,
      destination: null,
      origin_detail: null,
      destination_detail: null,
      position: {
        latitude: 0,
        longitude: 0,
        altitude_ft: null,
        heading: null,
        speed_kts: null,
        vertical_rate: null,
        on_ground: false,
      },
    });

    const flightPrompt = buildFlightExplainPrompt({ flight: emptyFlight });

    // These should never leak into prompts
    expect(skyPrompt).not.toContain("undefined");
    expect(skyPrompt).not.toMatch(/\bnull\b/);
    expect(flightPrompt).not.toContain("undefined");
    expect(flightPrompt).not.toMatch(/\bnull\b/);
  });
});

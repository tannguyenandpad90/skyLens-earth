/**
 * Prompt templates for Claude AI calls.
 *
 * Design principles:
 * - System prompt sets the ROLE and CONSTRAINTS (what NOT to do)
 * - User prompt provides the DATA and FORMAT instruction
 * - All data is structured, never free-text interpolated
 * - Prompts are pure functions (input → string) — easy to test
 */

import type { GlobalStats, FlightDetail } from "@skylens/types";

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

export const SKY_SUMMARY_SYSTEM = `You are an aviation intelligence analyst for SkyLens Earth.

Rules you MUST follow:
- ONLY reference data explicitly provided below. Do not invent flights, airlines, routes, or statistics.
- If a field says "N/A" or is empty, do not guess — omit it or say "data unavailable".
- Output exactly 2-4 markdown bullet points. No headings, no preamble, no sign-off.
- Each bullet must reference at least one specific number from the data.
- Mention anomalies first if any exist — they are the most newsworthy.
- Sound like a terse air-traffic analyst briefing a busy executive, not a chatbot.
- Never say "I" or "as an AI". Never speculate about causes you cannot see in the data.`;

export const FLIGHT_EXPLAIN_SYSTEM = `You are an aviation analyst for SkyLens Earth.

Rules:
- ONLY use the flight data provided below. Do not invent passengers, cargo, or purpose.
- Output 2-3 concise sentences. No bullet points.
- Include the route, aircraft type, and current phase of flight (climbing, cruising, descending, on ground) based on altitude and speed.
- If origin/destination are unknown, say so — do not guess.
- Sound like a professional briefing, not a chatbot.`;

// ---------------------------------------------------------------------------
// User prompts (data injection)
// ---------------------------------------------------------------------------

export interface SkySummaryInput {
  region: string;
  stats: GlobalStats;
  utcTime: string;
}

export function buildSkySummaryPrompt(input: SkySummaryInput): string {
  const { region, stats, utcTime } = input;

  const airports = stats.busiest_airports.length > 0
    ? stats.busiest_airports.map((a) => `${a.icao} ${a.name}: ${a.count} flights`).join("\n  ")
    : "No data";

  const routes = stats.busiest_routes.length > 0
    ? stats.busiest_routes.map((r) => `${r.origin} → ${r.destination}: ${r.count} flights`).join("\n  ")
    : "No data";

  const anomalies = stats.anomalies.length > 0
    ? stats.anomalies.map((a) => `[${a.type.toUpperCase()}] ${a.airport_icao}: ${a.message} (${a.factor}x normal)`).join("\n  ")
    : "None";

  return `Current UTC time: ${utcTime}
Region: ${region}

=== AIR TRAFFIC DATA ===
Total flights tracked globally: ${stats.total_flights.toLocaleString()}
Flights in this region: ${stats.flights_in_region?.toLocaleString() ?? "N/A"}

Top airports:
  ${airports}

Busiest routes:
  ${routes}

Anomalies:
  ${anomalies}
========================

Write 2-4 bullet points summarizing what's happening in the sky right now.`;
}

export interface FlightExplainInput {
  flight: FlightDetail;
}

export function buildFlightExplainPrompt(input: FlightExplainInput): string {
  const { flight } = input;

  const origin = flight.origin
    ? `${flight.origin.icao}${flight.origin_detail ? ` (${flight.origin_detail.name}, ${flight.origin_detail.city})` : ""}`
    : "Unknown";

  const destination = flight.destination
    ? `${flight.destination.icao}${flight.destination_detail ? ` (${flight.destination_detail.name}, ${flight.destination_detail.city})` : ""}`
    : "Unknown";

  const aircraft = flight.aircraft_detail
    ? `${flight.aircraft_detail.name} (${flight.aircraft_detail.icao}${flight.aircraft_detail.registration ? `, reg: ${flight.aircraft_detail.registration}` : ""})`
    : flight.aircraft ?? "Unknown";

  return `=== FLIGHT DATA ===
Callsign: ${flight.callsign ?? "Unknown"}
Airline code: ${flight.airline ?? "Unknown"}
Origin: ${origin}
Destination: ${destination}
Aircraft: ${aircraft}
Altitude: ${flight.position.altitude_ft != null ? `${flight.position.altitude_ft.toLocaleString()} ft` : "N/A"}
Ground speed: ${flight.position.speed_kts != null ? `${flight.position.speed_kts} kts` : "N/A"}
Heading: ${flight.position.heading != null ? `${flight.position.heading}°` : "N/A"}
Vertical rate: ${flight.position.vertical_rate != null ? `${flight.position.vertical_rate} ft/min` : "N/A"}
On ground: ${flight.position.on_ground ? "Yes" : "No"}
Status: ${flight.status}
===================

Explain this flight in 2-3 sentences.`;
}

// ---------------------------------------------------------------------------
// Fallback (when Claude is unavailable)
// ---------------------------------------------------------------------------

export function buildFallbackSummary(stats: GlobalStats): string {
  const total = stats.total_flights.toLocaleString();
  const topAirport = stats.busiest_airports[0];
  const anomalyCount = stats.anomalies.length;

  const parts: string[] = [
    `- **${total}** flights currently tracked.`,
  ];

  if (topAirport) {
    parts.push(`- Busiest airport: **${topAirport.name}** with ${topAirport.count} active flights.`);
  }

  if (anomalyCount > 0) {
    parts.push(`- **${anomalyCount}** traffic anomal${anomalyCount === 1 ? "y" : "ies"} detected.`);
  }

  parts.push(`\n*AI analysis temporarily unavailable. Showing raw statistics.*`);

  return parts.join("\n");
}

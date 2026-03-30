import Anthropic from "@anthropic-ai/sdk";
import type { GlobalStats, FlightDetail } from "@skylens/types";
import { REDIS_KEYS, CACHE_TTL } from "@skylens/lib";
import { redis } from "../db/redis";
import { getStats } from "./stats.service";
import { getFlightDetail } from "./flight.service";

const anthropic = new Anthropic();

function timeBucket(minutes: number): string {
  const now = new Date();
  const bucket = Math.floor(now.getTime() / (minutes * 60 * 1000));
  return bucket.toString();
}

export async function generateSkySummary(region?: string): Promise<{
  summary: string;
  generated_at: string;
  cached: boolean;
}> {
  const cacheKey = REDIS_KEYS.AI_SKY(region ?? "global", timeBucket(5));
  const cached = await redis.get(cacheKey);

  if (cached) {
    return { summary: cached, generated_at: new Date().toISOString(), cached: true };
  }

  const stats = await getStats(region as undefined);
  const prompt = buildSkySummaryPrompt(stats, region);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const summary =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  await redis.setex(cacheKey, CACHE_TTL.AI_SUMMARY, summary);

  return { summary, generated_at: new Date().toISOString(), cached: false };
}

export async function generateFlightExplanation(flightId: string): Promise<{
  explanation: string;
  generated_at: string;
  cached: boolean;
}> {
  const cacheKey = REDIS_KEYS.AI_FLIGHT(flightId);
  const cached = await redis.get(cacheKey);

  if (cached) {
    return { explanation: cached, generated_at: new Date().toISOString(), cached: true };
  }

  const flight = await getFlightDetail(flightId);
  if (!flight) {
    return {
      explanation: "Flight data not available.",
      generated_at: new Date().toISOString(),
      cached: false,
    };
  }

  const prompt = buildFlightExplainPrompt(flight);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const explanation =
    response.content[0]?.type === "text" ? response.content[0].text : "";

  await redis.setex(cacheKey, CACHE_TTL.AI_FLIGHT, explanation);

  return { explanation, generated_at: new Date().toISOString(), cached: false };
}

function buildSkySummaryPrompt(stats: GlobalStats, region?: string): string {
  const regionLabel = region && region !== "global" ? region.replace("_", " ") : "the world";
  return `You are an aviation analyst for SkyLens Earth, a real-time flight tracking platform.

Here are the current air traffic stats for ${regionLabel}:

- Total flights tracked: ${stats.total_flights}
- Flights in region: ${stats.flights_in_region ?? "N/A"}
- Top 5 busiest airports: ${stats.busiest_airports.map((a) => `${a.name} (${a.count})`).join(", ") || "N/A"}
- Busiest routes: ${stats.busiest_routes.map((r) => `${r.origin}→${r.destination} (${r.count})`).join(", ") || "N/A"}
- Active anomalies: ${stats.anomalies.map((a) => a.message).join("; ") || "None"}

Write a brief, engaging 3-4 bullet point summary of what's happening in the sky right now. Be specific with numbers. Mention anything unusual. Keep it concise and insightful — the reader is a busy executive. Use markdown formatting.`;
}

function buildFlightExplainPrompt(flight: FlightDetail): string {
  return `You are an aviation analyst. Explain this flight in plain English in 2-3 sentences:

- Callsign: ${flight.callsign ?? "Unknown"}
- Airline: ${flight.airline ?? "Unknown"}
- Route: ${flight.origin?.icao ?? "?"} → ${flight.destination?.icao ?? "?"}
- Aircraft: ${flight.aircraft_detail?.name ?? flight.aircraft ?? "Unknown"}
- Altitude: ${flight.position.altitude_ft ?? "N/A"} ft
- Speed: ${flight.position.speed_kts ?? "N/A"} kts
- Status: ${flight.status}

Include: who might be on this flight, why this route exists, anything interesting about the aircraft type or altitude. Be concise.`;
}

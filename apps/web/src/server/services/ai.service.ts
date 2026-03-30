import Anthropic from "@anthropic-ai/sdk";
import type { GlobalStats, FlightDetail } from "@skylens/types";
import { REDIS_KEYS, CACHE_TTL } from "@skylens/lib";
import { redis } from "../db/redis";
import { getStats } from "./stats.service";
import { getFlightDetail } from "./flight.service";
import {
  SKY_SUMMARY_SYSTEM,
  FLIGHT_EXPLAIN_SYSTEM,
  buildSkySummaryPrompt,
  buildFlightExplainPrompt,
  buildFallbackSummary,
} from "../lib/prompts";

// ---------------------------------------------------------------------------
// Claude client (lazy singleton)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic();
  }
  return _client;
}

/** Override for testing — inject a mock client. */
export function _setClientForTest(client: Anthropic | null): void {
  _client = client;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6-20250514";
const SUMMARY_MAX_TOKENS = 400;
const EXPLAIN_MAX_TOKENS = 300;
const CLAUDE_TIMEOUT_MS = 15_000;

// ---------------------------------------------------------------------------
// Time bucket for cache keys
// ---------------------------------------------------------------------------

function timeBucket(minutes: number): string {
  const now = new Date();
  return Math.floor(now.getTime() / (minutes * 60 * 1000)).toString();
}

// ---------------------------------------------------------------------------
// Sky summary
// ---------------------------------------------------------------------------

export async function generateSkySummary(region?: string): Promise<{
  summary: string;
  generated_at: string;
  cached: boolean;
}> {
  const regionKey = region ?? "global";
  const cacheKey = REDIS_KEYS.AI_SKY(regionKey, timeBucket(5));

  // 1. Check cache
  const cached = await tryRedisGet(cacheKey);
  if (cached) {
    return { summary: cached, generated_at: new Date().toISOString(), cached: true };
  }

  // 2. Gather data
  const stats = await getStats(region as undefined);

  // 3. Short-circuit if no data at all
  if (stats.total_flights === 0) {
    const fallback = "- No flight data currently available. The data feed may be initializing.";
    return { summary: fallback, generated_at: new Date().toISOString(), cached: false };
  }

  // 4. Call Claude (with fallback)
  const regionLabel = region && region !== "global"
    ? region.replace(/_/g, " ")
    : "the world";

  const prompt = buildSkySummaryPrompt({
    region: regionLabel,
    stats,
    utcTime: new Date().toISOString().slice(0, 19) + "Z",
  });

  const summary = await callClaude({
    system: SKY_SUMMARY_SYSTEM,
    prompt,
    maxTokens: SUMMARY_MAX_TOKENS,
    fallback: () => buildFallbackSummary(stats),
  });

  // 5. Cache result
  await tryRedisSet(cacheKey, summary, CACHE_TTL.AI_SUMMARY);

  return { summary, generated_at: new Date().toISOString(), cached: false };
}

// ---------------------------------------------------------------------------
// Flight explanation
// ---------------------------------------------------------------------------

export async function generateFlightExplanation(flightId: string): Promise<{
  explanation: string;
  generated_at: string;
  cached: boolean;
}> {
  const cacheKey = REDIS_KEYS.AI_FLIGHT(flightId);

  // 1. Check cache
  const cached = await tryRedisGet(cacheKey);
  if (cached) {
    return { explanation: cached, generated_at: new Date().toISOString(), cached: true };
  }

  // 2. Gather data
  const flight = await getFlightDetail(flightId);
  if (!flight) {
    return {
      explanation: "Flight data not available for this aircraft.",
      generated_at: new Date().toISOString(),
      cached: false,
    };
  }

  // 3. Call Claude (with fallback)
  const prompt = buildFlightExplainPrompt({ flight });

  const explanation = await callClaude({
    system: FLIGHT_EXPLAIN_SYSTEM,
    prompt,
    maxTokens: EXPLAIN_MAX_TOKENS,
    fallback: () => buildFlightFallback(flight),
  });

  // 4. Cache result
  await tryRedisSet(cacheKey, explanation, CACHE_TTL.AI_FLIGHT);

  return { explanation, generated_at: new Date().toISOString(), cached: false };
}

// ---------------------------------------------------------------------------
// Claude call wrapper with timeout + fallback
// ---------------------------------------------------------------------------

interface CallClaudeOpts {
  system: string;
  prompt: string;
  maxTokens: number;
  fallback: () => string;
}

async function callClaude(opts: CallClaudeOpts): Promise<string> {
  try {
    const client = getClient();

    const response = await Promise.race([
      client.messages.create({
        model: MODEL,
        max_tokens: opts.maxTokens,
        system: opts.system,
        messages: [{ role: "user", content: opts.prompt }],
      }),
      timeout(CLAUDE_TIMEOUT_MS),
    ]);

    if (!response) return opts.fallback();

    const text = response.content[0]?.type === "text"
      ? response.content[0].text
      : "";

    return text || opts.fallback();
  } catch (err) {
    console.error("[ai.service] Claude call failed:", err instanceof Error ? err.message : err);
    return opts.fallback();
  }
}

function timeout(ms: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

// ---------------------------------------------------------------------------
// Flight fallback (when Claude is unavailable)
// ---------------------------------------------------------------------------

function buildFlightFallback(flight: FlightDetail): string {
  const parts: string[] = [];
  const callsign = flight.callsign ?? "Unknown aircraft";

  if (flight.origin && flight.destination) {
    parts.push(`${callsign} is operating from ${flight.origin.icao} to ${flight.destination.icao}.`);
  } else {
    parts.push(`${callsign} is currently tracked.`);
  }

  if (flight.position.altitude_ft != null) {
    const alt = flight.position.altitude_ft;
    if (alt < 100) {
      parts.push("The aircraft is currently on the ground.");
    } else if (alt < 10000) {
      parts.push(`Currently at ${alt.toLocaleString()} ft — likely in a climb or descent phase.`);
    } else {
      parts.push(`Cruising at ${alt.toLocaleString()} ft.`);
    }
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Redis helpers (never let Redis errors kill the AI flow)
// ---------------------------------------------------------------------------

async function tryRedisGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function tryRedisSet(key: string, value: string, ttl: number): Promise<void> {
  try {
    await redis.setex(key, ttl, value);
  } catch {
    // Swallow — caching is best-effort
  }
}

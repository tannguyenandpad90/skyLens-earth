import type { FlightDataProvider } from "./provider.interface";
import type { FlightPosition, FlightStatus } from "@skylens/types";
import {
  OpenSkyResponseSchema,
  type OpenSkyStateVector,
} from "./opensky.types";

// --- Unit conversions ---

const METERS_TO_FEET = 3.28084;
const MPS_TO_KNOTS = 1.94384;

// --- Normalized flight type (flat, API-agnostic) ---

export type NormalizedFlight = {
  id: string;
  lat: number;
  lon: number;
  altitudeFt?: number;
  groundSpeedKt?: number;
  headingDeg?: number;
  callsign?: string;
  originIata?: string;
  destinationIata?: string;
  timestamp: string;
};

// --- Provider implementation ---

const OPENSKY_BASE_URL = "https://opensky-network.org/api";
const REQUEST_TIMEOUT_MS = 20_000;

export class OpenSkyProvider implements FlightDataProvider {
  readonly name = "OpenSky";

  private readonly credentials: { username: string; password: string } | null;

  constructor(opts?: { username?: string; password?: string }) {
    this.credentials =
      opts?.username && opts?.password
        ? { username: opts.username, password: opts.password }
        : null;
  }

  /**
   * Fetch all live flights from OpenSky, validate with Zod,
   * normalize into the internal schema, and return as FlightPosition[].
   */
  async fetchLiveFlights(): Promise<FlightPosition[]> {
    const normalized = await this.fetchAndNormalize();
    return normalized.map(toFlightPosition);
  }

  /**
   * Lower-level method: fetch + validate + normalize into NormalizedFlight[].
   * Useful for testing and direct consumption.
   */
  async fetchAndNormalize(): Promise<NormalizedFlight[]> {
    const raw = await this.fetchRaw();
    return raw.map(stateToNormalized).filter(isValid);
  }

  /**
   * Fetch and validate the raw OpenSky response.
   * Returns parsed + validated state vectors.
   */
  async fetchRaw(): Promise<OpenSkyStateVector[]> {
    const url = `${OPENSKY_BASE_URL}/states/all`;
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.credentials) {
      const encoded = Buffer.from(
        `${this.credentials.username}:${this.credentials.password}`,
      ).toString("base64");
      headers["Authorization"] = `Basic ${encoded}`;
    }

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 429) {
      throw new OpenSkyRateLimitError(
        "OpenSky rate limit exceeded. Anonymous: 10 req/min, authenticated: 40 req/min.",
      );
    }

    if (!res.ok) {
      throw new OpenSkyApiError(
        `OpenSky API error: ${res.status} ${res.statusText}`,
        res.status,
      );
    }

    const json: unknown = await res.json();
    const parsed = OpenSkyResponseSchema.safeParse(json);

    if (!parsed.success) {
      throw new OpenSkyValidationError(
        `Failed to validate OpenSky response: ${parsed.error.message}`,
      );
    }

    return parsed.data.states ?? [];
  }
}

// --- Transform: state vector → NormalizedFlight ---

export function stateToNormalized(state: OpenSkyStateVector): NormalizedFlight {
  const timestamp = state.time_position
    ? new Date(state.time_position * 1000).toISOString()
    : new Date(state.last_contact * 1000).toISOString();

  return {
    id: state.icao24,
    lat: state.latitude ?? 0,
    lon: state.longitude ?? 0,
    altitudeFt: metersToFeet(state.baro_altitude ?? state.geo_altitude),
    groundSpeedKt: mpsToKnots(state.velocity),
    headingDeg: roundTo(state.true_track, 1),
    callsign: state.callsign ?? undefined,
    // OpenSky doesn't provide origin/destination — left undefined
    originIata: undefined,
    destinationIata: undefined,
    timestamp,
  };
}

// --- Transform: NormalizedFlight → FlightPosition (internal schema) ---

function toFlightPosition(flight: NormalizedFlight): FlightPosition {
  return {
    id: `${flight.id}-${flight.timestamp.slice(0, 10)}`,
    callsign: flight.callsign ?? null,
    airline: extractAirline(flight.callsign),
    aircraft: null, // OpenSky doesn't provide aircraft type
    origin: flight.originIata
      ? { icao: flight.originIata, name: "" }
      : null,
    destination: flight.destinationIata
      ? { icao: flight.destinationIata, name: "" }
      : null,
    position: {
      latitude: flight.lat,
      longitude: flight.lon,
      altitude_ft: flight.altitudeFt ?? null,
      heading: flight.headingDeg ?? null,
      speed_kts: flight.groundSpeedKt ?? null,
      vertical_rate: null,
      on_ground: (flight.altitudeFt ?? 0) < 100,
    },
    status: inferStatus(flight),
    squawk: null,
  };
}

// --- Validation filter ---

function isValid(flight: NormalizedFlight): boolean {
  // Must have real coordinates (not 0,0 which is null ocean)
  if (flight.lat === 0 && flight.lon === 0) return false;
  // Latitude/longitude range check
  if (flight.lat < -90 || flight.lat > 90) return false;
  if (flight.lon < -180 || flight.lon > 180) return false;
  return true;
}

// --- Helpers ---

function metersToFeet(meters: number | null): number | undefined {
  if (meters == null) return undefined;
  return Math.round(meters * METERS_TO_FEET);
}

function mpsToKnots(mps: number | null): number | undefined {
  if (mps == null) return undefined;
  return Math.round(mps * MPS_TO_KNOTS);
}

function roundTo(value: number | null, decimals: number): number | undefined {
  if (value == null) return undefined;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function extractAirline(callsign: string | undefined): string | null {
  if (!callsign || callsign.length < 3) return null;
  // ICAO airline prefix is typically the first 3 alpha characters
  const match = callsign.match(/^([A-Z]{3})/);
  return match ? match[1]! : null;
}

function inferStatus(flight: NormalizedFlight): FlightStatus {
  if ((flight.altitudeFt ?? 0) < 100) return "landed";
  if ((flight.groundSpeedKt ?? 0) < 30 && (flight.altitudeFt ?? 0) < 500) return "taxiing";
  return "en-route";
}

// --- Error classes ---

export class OpenSkyApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OpenSkyApiError";
  }
}

export class OpenSkyRateLimitError extends OpenSkyApiError {
  constructor(message: string) {
    super(message, 429);
    this.name = "OpenSkyRateLimitError";
  }
}

export class OpenSkyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenSkyValidationError";
  }
}

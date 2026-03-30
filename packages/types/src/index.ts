// ============================================================
// SkyLens Earth — Shared Type Definitions
// ============================================================

// --- Geographic ---

export interface Position {
  latitude: number;
  longitude: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// --- Airport ---

export interface Airport {
  icao_code: string;
  iata_code: string | null;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  elevation_ft: number | null;
}

export interface AirportSummary {
  icao: string;
  iata: string | null;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  active_flights: number;
}

export interface AirportDetail extends AirportSummary {
  stats: {
    departures: number;
    arrivals: number;
    on_ground: number;
  };
  anomaly: Anomaly | null;
}

// --- Flight ---

export interface FlightPosition {
  id: string;
  callsign: string | null;
  airline: string | null;
  aircraft: string | null;
  origin: { icao: string; name: string } | null;
  destination: { icao: string; name: string } | null;
  position: {
    latitude: number;
    longitude: number;
    altitude_ft: number | null;
    heading: number | null;
    speed_kts: number | null;
    vertical_rate: number | null;
    on_ground: boolean;
  };
  status: FlightStatus;
  squawk: string | null;
}

export interface FlightDetail extends FlightPosition {
  aircraft_detail: {
    icao: string;
    name: string;
    registration: string | null;
  } | null;
  origin_detail: AirportSummary | null;
  destination_detail: AirportSummary | null;
  trail: TrailPoint[];
}

export interface TrailPoint {
  lat: number;
  lng: number;
  alt: number | null;
  ts: string;
}

export type FlightStatus =
  | "en-route"
  | "landed"
  | "scheduled"
  | "taxiing"
  | "unknown";

// --- Stats ---

export interface GlobalStats {
  total_flights: number;
  flights_in_region: number | null;
  busiest_airports: AirportCount[];
  busiest_routes: RouteCount[];
  anomalies: Anomaly[];
  updated_at: string;
}

export interface AirportCount {
  icao: string;
  name: string;
  count: number;
}

export interface RouteCount {
  origin: string;
  destination: string;
  count: number;
}

// --- Anomaly ---

export interface Anomaly {
  airport_icao: string;
  type: "high_traffic" | "low_traffic" | "unusual_pattern";
  factor: number;
  message: string;
}

// --- AI ---

export interface AISummaryRequest {
  region?: string;
}

export interface AISummaryResponse {
  summary: string;
  generated_at: string;
  cached: boolean;
}

export interface AIFlightExplainRequest {
  flight_id: string;
}

export interface AIFlightExplainResponse {
  explanation: string;
  generated_at: string;
  cached: boolean;
}

// --- API ---

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    retry_after?: number;
  };
}

export interface FlightsResponse {
  flights: FlightPosition[];
  count: number;
  updated_at: string;
}

export interface StatsResponse extends GlobalStats {}

// --- Regions ---

export type Region =
  | "global"
  | "north_america"
  | "europe"
  | "asia"
  | "south_america"
  | "africa"
  | "oceania";

export const REGION_BOUNDS: Record<Region, BoundingBox> = {
  global: { north: 90, south: -90, east: 180, west: -180 },
  north_america: { north: 72, south: 15, east: -50, west: -170 },
  europe: { north: 72, south: 35, east: 45, west: -25 },
  asia: { north: 55, south: -10, east: 150, west: 60 },
  south_america: { north: 15, south: -56, east: -34, west: -82 },
  africa: { north: 37, south: -35, east: 52, west: -18 },
  oceania: { north: 0, south: -48, east: 180, west: 110 },
};

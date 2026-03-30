import type { FlightPosition, FlightStatus } from "@skylens/types";
import type { FlightDataProvider } from "./provider.interface";

interface AviationStackFlight {
  flight?: { iata?: string; icao?: string; number?: string };
  airline?: { name?: string; iata?: string; icao?: string };
  aircraft?: { icao?: string; registration?: string };
  departure?: { icao?: string; airport?: string };
  arrival?: { icao?: string; airport?: string };
  live?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
    direction?: number;
    speed_horizontal?: number;
    speed_vertical?: number;
    is_ground?: boolean;
  };
  flight_status?: string;
}

function mapStatus(raw?: string): FlightStatus {
  switch (raw) {
    case "active":
      return "en-route";
    case "landed":
      return "landed";
    case "scheduled":
      return "scheduled";
    default:
      return "unknown";
  }
}

export class AviationStackProvider implements FlightDataProvider {
  readonly name = "AviationStack";
  private readonly apiKey: string;
  private readonly baseUrl = "http://api.aviationstack.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchLiveFlights(): Promise<FlightPosition[]> {
    const url = `${this.baseUrl}/flights?access_key=${this.apiKey}&limit=5000&flight_status=active`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

    if (!res.ok) {
      throw new Error(`AviationStack API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as { data: AviationStackFlight[] };

    return json.data
      .filter((f) => f.live?.latitude != null && f.live?.longitude != null)
      .map((f): FlightPosition => {
        const id =
          f.flight?.icao ??
          f.flight?.iata ??
          `unknown-${f.live!.latitude}-${f.live!.longitude}`;
        return {
          id: `${id}-${new Date().toISOString().slice(0, 10)}`,
          callsign: f.flight?.icao ?? f.flight?.iata ?? null,
          airline: f.airline?.name ?? null,
          aircraft: f.aircraft?.icao ?? null,
          origin: f.departure?.icao
            ? { icao: f.departure.icao, name: f.departure.airport ?? "" }
            : null,
          destination: f.arrival?.icao
            ? { icao: f.arrival.icao, name: f.arrival.airport ?? "" }
            : null,
          position: {
            latitude: f.live!.latitude!,
            longitude: f.live!.longitude!,
            altitude_ft: f.live?.altitude
              ? Math.round(f.live.altitude * 3.28084)
              : null,
            heading: f.live?.direction ?? null,
            speed_kts: f.live?.speed_horizontal
              ? Math.round(f.live.speed_horizontal * 0.539957)
              : null,
            vertical_rate: f.live?.speed_vertical
              ? Math.round(f.live.speed_vertical * 3.28084)
              : null,
            on_ground: f.live?.is_ground ?? false,
          },
          status: mapStatus(f.flight_status),
          squawk: null,
        };
      });
  }
}

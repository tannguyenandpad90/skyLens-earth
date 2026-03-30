import type { FlightPosition } from "@skylens/types";
import type { FlightDataProvider } from "./provider.interface";

/**
 * Fallback provider using AeroDataBox via RapidAPI.
 * Kept as a stub — implement when AviationStack quota runs out.
 */
export class AeroDataBoxProvider implements FlightDataProvider {
  readonly name = "AeroDataBox";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchLiveFlights(): Promise<FlightPosition[]> {
    // TODO: Implement AeroDataBox integration
    throw new Error("AeroDataBox provider not yet implemented");
  }
}

import type { FlightPosition } from "@skylens/types";

/**
 * Common interface for flight data providers.
 * Swap implementations without changing service layer.
 */
export interface FlightDataProvider {
  readonly name: string;

  /** Fetch all currently tracked flights. */
  fetchLiveFlights(): Promise<FlightPosition[]>;
}

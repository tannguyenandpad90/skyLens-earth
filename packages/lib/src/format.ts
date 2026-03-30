/**
 * Display formatting utilities for flight data.
 */

export function formatCallsign(callsign: string | null): string {
  if (!callsign) return "N/A";
  return callsign.trim().toUpperCase();
}

export function formatAltitude(altitudeFt: number | null): string {
  if (altitudeFt == null) return "—";
  if (altitudeFt < 100) return "GND";
  return `FL${Math.round(altitudeFt / 100)}`;
}

export function formatSpeed(speedKts: number | null): string {
  if (speedKts == null) return "—";
  return `${speedKts} kts`;
}

export function formatHeading(heading: number | null): string {
  if (heading == null) return "—";
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(heading / 45) % 8;
  return `${heading}° ${directions[index]}`;
}

/**
 * Prompt templates for Claude AI calls.
 * Centralized here for easy tuning and testing.
 */

export const SYSTEM_PROMPT = `You are an aviation intelligence analyst for SkyLens Earth, a real-time global flight tracking platform. Your audience is busy executives who want quick, data-driven insights. Be concise, specific with numbers, and highlight anything unusual or noteworthy. Use markdown formatting.`;

export const FALLBACK_SUMMARY = (totalFlights: number, topAirport?: string) =>
  `**AI summary temporarily unavailable.** Current stats: ${totalFlights.toLocaleString()} flights tracked${topAirport ? `, busiest airport: ${topAirport}` : ""}.`;

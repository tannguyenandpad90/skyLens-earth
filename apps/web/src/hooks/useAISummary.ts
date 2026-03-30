import { useMutation } from "@tanstack/react-query";
import type { AISummaryResponse, AIFlightExplainResponse } from "@skylens/types";
import { api } from "@/lib/api-client";

export function useSkySummary() {
  return useMutation({
    mutationFn: (region?: string) =>
      api.post<AISummaryResponse>("/api/ai/sky-summary", { region }),
  });
}

export function useFlightExplain() {
  return useMutation({
    mutationFn: (flightId: string) =>
      api.post<AIFlightExplainResponse>("/api/ai/flight-explain", {
        flight_id: flightId,
      }),
  });
}

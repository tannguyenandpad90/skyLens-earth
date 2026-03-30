import { useQuery } from "@tanstack/react-query";
import type { AirportDetail } from "@skylens/types";
import { api } from "@/lib/api-client";

export function useAirport(icao: string | null) {
  return useQuery({
    queryKey: ["airport", icao],
    queryFn: () => api.get<{ airport: AirportDetail }>(`/api/airports/${icao}`),
    enabled: icao !== null,
    staleTime: 60_000,
  });
}

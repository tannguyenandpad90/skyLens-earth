import { useQuery } from "@tanstack/react-query";
import type { BoundingBox, FlightsResponse } from "@skylens/types";
import { CLIENT_REFETCH_MS } from "@skylens/lib";
import { api } from "@/lib/api-client";
import { boundsToQuery } from "@/lib/map-utils";

export function useFlights(bounds: BoundingBox | null) {
  return useQuery({
    queryKey: ["flights", bounds],
    queryFn: () => {
      const query = bounds ? `?${boundsToQuery(bounds)}` : "";
      return api.get<FlightsResponse>(`/api/flights${query}`);
    },
    enabled: bounds !== null,
    refetchInterval: CLIENT_REFETCH_MS,
    staleTime: CLIENT_REFETCH_MS - 2_000,
    placeholderData: (prev) => prev,
  });
}

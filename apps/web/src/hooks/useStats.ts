import { useQuery } from "@tanstack/react-query";
import type { StatsResponse, Region } from "@skylens/types";
import { CLIENT_STATS_REFETCH_MS } from "@skylens/lib";
import { api } from "@/lib/api-client";

export function useStats(region?: Region) {
  const query = region && region !== "global" ? `?region=${region}` : "";
  return useQuery({
    queryKey: ["stats", region],
    queryFn: () => api.get<StatsResponse>(`/api/stats${query}`),
    refetchInterval: CLIENT_STATS_REFETCH_MS,
    staleTime: CLIENT_STATS_REFETCH_MS - 5_000,
  });
}

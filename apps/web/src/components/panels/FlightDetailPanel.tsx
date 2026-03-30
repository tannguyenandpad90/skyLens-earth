"use client";

import { useQuery } from "@tanstack/react-query";
import type { FlightDetail } from "@skylens/types";
import { formatAltitude, formatSpeed, formatHeading } from "@skylens/lib";
import { Skeleton, Spinner } from "@skylens/ui";
import { useFlightExplain } from "@/hooks/useAISummary";
import { useUIStore } from "@/stores/ui-store";
import { api } from "@/lib/api-client";

interface Props {
  flightId: string;
}

export function FlightDetailPanel({ flightId }: Props) {
  const selectFlight = useUIStore((s) => s.selectFlight);
  const explain = useFlightExplain();

  const { data, isLoading } = useQuery({
    queryKey: ["flight", flightId],
    queryFn: () => api.get<{ flight: FlightDetail }>(`/api/flights/${flightId}`),
  });

  const flight = data?.flight;

  return (
    <div className="panel flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span>{flight?.callsign ?? "Flight Detail"}</span>
        <button
          onClick={() => selectFlight(null)}
          className="text-slate-500 hover:text-white"
          aria-label="Close"
        >
          &times;
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3 p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ) : flight ? (
        <div className="flex-1 space-y-4 p-4">
          {/* Route */}
          <div className="flex items-center justify-between text-lg font-bold">
            <span>{flight.origin?.icao ?? "???"}</span>
            <span className="text-slate-600">→</span>
            <span>{flight.destination?.icao ?? "???"}</span>
          </div>

          {/* Position data */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="stat-label">Altitude</div>
              <div>{formatAltitude(flight.position.altitude_ft)}</div>
            </div>
            <div>
              <div className="stat-label">Speed</div>
              <div>{formatSpeed(flight.position.speed_kts)}</div>
            </div>
            <div>
              <div className="stat-label">Heading</div>
              <div>{formatHeading(flight.position.heading)}</div>
            </div>
            <div>
              <div className="stat-label">Status</div>
              <div className="capitalize">{flight.status}</div>
            </div>
          </div>

          {/* Aircraft */}
          {flight.aircraft_detail && (
            <div className="text-sm">
              <div className="stat-label">Aircraft</div>
              <div>
                {flight.aircraft_detail.name}{" "}
                {flight.aircraft_detail.registration && (
                  <span className="text-slate-500">
                    ({flight.aircraft_detail.registration})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* AI Explain */}
          <div className="border-t border-slate-800 pt-4">
            {explain.data ? (
              <div className="prose prose-sm prose-invert">
                <p>{explain.data.explanation}</p>
              </div>
            ) : (
              <button
                onClick={() => explain.mutate(flightId)}
                disabled={explain.isPending}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
              >
                {explain.isPending && <Spinner size="sm" />}
                Explain this flight
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useAirport } from "@/hooks/useAirport";
import { Badge, Skeleton } from "@skylens/ui";

interface Props {
  icao: string;
  onClose: () => void;
}

export function AirportPanel({ icao, onClose }: Props) {
  const { data, isLoading } = useAirport(icao);
  const airport = data?.airport;

  return (
    <div className="panel w-80">
      <div className="panel-header flex items-center justify-between">
        <span>{icao}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white">
          &times;
        </button>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : airport ? (
          <div className="space-y-3">
            <h3 className="font-semibold">{airport.name}</h3>
            <p className="text-sm text-slate-400">
              {airport.city}, {airport.country}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="stat-value text-base">{airport.stats.departures}</div>
                <div className="stat-label">Dep</div>
              </div>
              <div>
                <div className="stat-value text-base">{airport.stats.arrivals}</div>
                <div className="stat-label">Arr</div>
              </div>
              <div>
                <div className="stat-value text-base">{airport.stats.on_ground}</div>
                <div className="stat-label">Ground</div>
              </div>
            </div>
            {airport.anomaly && (
              <Badge variant="warning">{airport.anomaly.message}</Badge>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

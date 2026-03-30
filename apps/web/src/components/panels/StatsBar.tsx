"use client";

import { useStats } from "@/hooks/useStats";
import { useUIStore } from "@/stores/ui-store";
import { Skeleton } from "@skylens/ui";

export function StatsBar() {
  const region = useUIStore((s) => s.region);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const { data, isLoading } = useStats(region);

  return (
    <div className="panel flex items-center gap-6 px-4 py-2">
      {isLoading ? (
        <>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-40" />
        </>
      ) : data ? (
        <>
          <div>
            <div className="stat-value">{data.total_flights.toLocaleString()}</div>
            <div className="stat-label">Flights tracked</div>
          </div>

          {data.busiest_airports[0] && (
            <div>
              <div className="stat-value text-lg">{data.busiest_airports[0].name}</div>
              <div className="stat-label">
                Busiest — {data.busiest_airports[0].count} flights
              </div>
            </div>
          )}

          {data.anomalies.length > 0 && (
            <div className="rounded-full bg-amber-900/40 px-3 py-1 text-xs text-amber-300">
              {data.anomalies.length} anomal{data.anomalies.length === 1 ? "y" : "ies"}
            </div>
          )}

          <div className="ml-auto">
            <button
              onClick={toggleAIPanel}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              What&apos;s happening?
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

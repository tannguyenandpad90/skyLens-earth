"use client";

import type { FlightTooltipData } from "@/hooks/useFlightTooltip";

interface Props {
  data: FlightTooltipData;
}

function formatAlt(ft: number): string {
  if (ft < 100) return "GND";
  return `FL${Math.round(ft / 100)}`;
}

function formatRoute(origin: string, dest: string): string | null {
  if (!origin && !dest) return null;
  return `${origin || "?"} → ${dest || "?"}`;
}

export function FlightTooltip({ data }: Props) {
  const route = formatRoute(data.originIata, data.destinationIata);

  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{
        left: data.x + 12,
        top: data.y - 12,
      }}
    >
      <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 shadow-2xl backdrop-blur-sm">
        {/* Callsign */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-indigo-400">
            {data.callsign || "N/A"}
          </span>
          {route && (
            <span className="text-xs text-slate-500">{route}</span>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
          <span>
            <span className="text-slate-500">ALT </span>
            <span className="text-slate-200">{formatAlt(data.altitudeFt)}</span>
          </span>
          <span>
            <span className="text-slate-500">GS </span>
            <span className="text-slate-200">{data.groundSpeedKt} kt</span>
          </span>
          <span>
            <span className="text-slate-500">HDG </span>
            <span className="text-slate-200">{Math.round(data.headingDeg)}°</span>
          </span>
        </div>
      </div>
    </div>
  );
}

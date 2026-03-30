"use client";

const STOPS = [
  { color: "#22d3ee", label: "GND" },
  { color: "#3b82f6", label: "FL100" },
  { color: "#8b5cf6", label: "FL250" },
  { color: "#a78bfa", label: "FL350" },
  { color: "#f472b6", label: "FL450" },
];

export function AltitudeLegend() {
  return (
    <div className="absolute bottom-6 right-4 z-10 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 backdrop-blur-sm">
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Altitude
      </div>
      <div className="flex items-center gap-0">
        {STOPS.map((stop) => (
          <div key={stop.label} className="flex flex-col items-center">
            <div
              className="h-2 w-8 first:rounded-l last:rounded-r"
              style={{ backgroundColor: stop.color }}
            />
            <span className="mt-0.5 text-[9px] text-slate-500">{stop.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

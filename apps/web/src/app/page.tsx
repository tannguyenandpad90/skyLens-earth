"use client";

import { FlightMap } from "@/components/map/FlightMap";
import { StatsBar } from "@/components/panels/StatsBar";
import { FlightDetailPanel } from "@/components/panels/FlightDetailPanel";
import { AISummaryPanel } from "@/components/panels/AISummaryPanel";
import { SearchBar } from "@/components/search/SearchBar";
import { useUIStore } from "@/stores/ui-store";

export default function HomePage() {
  const selectedFlightId = useUIStore((s) => s.selectedFlightId);
  const showAIPanel = useUIStore((s) => s.showAIPanel);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Map — full screen background */}
      <FlightMap />

      {/* Top bar — stats + search */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start gap-3 p-4">
        <div className="pointer-events-auto">
          <SearchBar />
        </div>
        <div className="pointer-events-auto flex-1">
          <StatsBar />
        </div>
      </div>

      {/* Right panel — flight detail */}
      {selectedFlightId && (
        <div className="absolute right-0 top-0 z-20 h-full w-96">
          <FlightDetailPanel flightId={selectedFlightId} />
        </div>
      )}

      {/* Bottom panel — AI summary */}
      {showAIPanel && (
        <div className="absolute bottom-0 left-0 z-20 w-full max-w-2xl p-4">
          <AISummaryPanel />
        </div>
      )}
    </div>
  );
}

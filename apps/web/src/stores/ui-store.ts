import { create } from "zustand";
import type { BoundingBox, Region } from "@skylens/types";

interface UIState {
  selectedFlightId: string | null;
  showAIPanel: boolean;
  region: Region;
  mapBounds: BoundingBox | null;

  selectFlight: (id: string | null) => void;
  toggleAIPanel: () => void;
  setRegion: (region: Region) => void;
  setMapBounds: (bounds: BoundingBox) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedFlightId: null,
  showAIPanel: false,
  region: "global",
  mapBounds: null,

  selectFlight: (id) => set({ selectedFlightId: id }),
  toggleAIPanel: () => set((s) => ({ showAIPanel: !s.showAIPanel })),
  setRegion: (region) => set({ region }),
  setMapBounds: (mapBounds) => set({ mapBounds }),
}));

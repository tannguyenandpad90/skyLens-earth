"use client";

import { useState, useCallback } from "react";
import type { AirportSummary } from "@skylens/types";
import { api } from "@/lib/api-client";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AirportSummary[]>([]);
  const [open, setOpen] = useState(false);

  const search = useCallback(async (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    try {
      const data = await api.get<{ airports: AirportSummary[] }>(
        `/api/airports?search=${encodeURIComponent(value)}`,
      );
      setResults(data.airports);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }, []);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Search airports..."
        className="w-64 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none backdrop-blur-sm focus:border-indigo-500"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {results.map((airport) => (
            <button
              key={airport.icao}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-800"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQuery(airport.icao);
                setOpen(false);
              }}
            >
              <span className="font-mono font-bold text-indigo-400">
                {airport.iata ?? airport.icao}
              </span>
              <span className="truncate text-slate-400">{airport.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useSkySummary } from "@/hooks/useAISummary";
import { Spinner } from "@skylens/ui";

export function AISummaryPanel() {
  const region = useUIStore((s) => s.region);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const { mutate, data, isPending, error } = useSkySummary();

  useEffect(() => {
    mutate(region);
  }, [mutate, region]);

  return (
    <div className="panel">
      <div className="panel-header flex items-center justify-between">
        <span>AI Sky Summary</span>
        <button
          onClick={toggleAIPanel}
          className="text-slate-500 hover:text-white"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      <div className="p-4">
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Spinner size="sm" />
            Analyzing the skies...
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400">
            Failed to generate summary. Try again later.
          </p>
        )}
        {data && (
          <div className="prose prose-sm prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: data.summary }} />
            {data.cached && (
              <p className="mt-2 text-xs text-slate-600">
                Cached — generated at {new Date(data.generated_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

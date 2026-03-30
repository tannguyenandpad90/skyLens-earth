"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/ui-store";
import { useSkySummary } from "@/hooks/useAISummary";
import { Spinner } from "@skylens/ui";

/**
 * Render markdown-ish text safely without dangerouslySetInnerHTML.
 * Handles: **bold**, bullet points (- or *), and line breaks.
 */
function SafeMarkdown({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
        const content = isBullet ? trimmed.slice(2) : trimmed;

        // Replace **bold** with <strong>
        const parts = content.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="text-slate-100">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-300">
              <span className="text-slate-600">•</span>
              <span>{parts}</span>
            </div>
          );
        }

        return (
          <p key={i} className="text-sm text-slate-300">
            {parts}
          </p>
        );
      })}
    </div>
  );
}

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
          <div>
            <SafeMarkdown text={data.summary} />
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

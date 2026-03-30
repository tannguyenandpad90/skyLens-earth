import React from "react";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-red-800/50 bg-red-950/30 p-4 text-sm text-red-300">
      <p>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded bg-red-800/40 px-3 py-1 text-xs hover:bg-red-800/60 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

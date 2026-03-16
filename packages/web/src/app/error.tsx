"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-mono font-bold uppercase tracking-wider text-red-400 magi-glow">
          SYSTEM ERROR
        </h1>
        <p className="text-text-dim text-sm font-mono max-w-md text-center">
          {error.message || "UNEXPECTED ERROR OCCURRED"}
        </p>
      </div>
      <button
        onClick={reset}
        className="border border-accent bg-accent/10 px-6 py-2 text-xs font-mono font-bold text-accent uppercase tracking-wider hover:bg-accent/20 transition-colors"
      >
        RETRY
      </button>
    </div>
  );
}

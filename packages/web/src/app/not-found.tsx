import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-6xl font-mono font-bold text-red-400 magi-glow-strong">
          404
        </h1>
        <p className="text-lg font-mono font-bold uppercase tracking-wider text-text-dim">
          TARGET NOT FOUND
        </p>
      </div>
      <Link
        href="/"
        className="text-accent hover:underline text-xs font-mono uppercase tracking-wider"
      >
        &gt;&gt; RETURN TO MAIN TERMINAL
      </Link>
    </div>
  );
}

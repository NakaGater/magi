import { TaskForm } from "@/components/TaskForm";
import { ROLE_CONFIG } from "@/lib/constants";

const MAGI_UNITS = [
  { key: "PM", name: "MELCHIOR-1", subtitle: "PM", status: "ONLINE" },
  { key: "PD", name: "BALTHASAR-2", subtitle: "PD", status: "ONLINE" },
  { key: "Dev", name: "CASPER-3", subtitle: "DEV", status: "ONLINE" },
] as const;

export default function Home() {
  return (
    <div className="flex flex-col items-center pt-12 gap-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-mono font-bold uppercase tracking-wider text-accent magi-glow-strong">
          MAGI SYSTEM
        </h1>
        <p className="text-text-dim font-mono text-xs uppercase tracking-wider">
          Super-Computer Decision System
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
        {/* Row 1: MELCHIOR-1 centered */}
        <div className="flex justify-center">
          {(() => {
            const unit = MAGI_UNITS[0];
            const config = ROLE_CONFIG[unit.key];
            return (
              <div
                className="magi-frame bg-surface p-6 text-center w-[300px]"
                style={{ borderColor: `${config.color}40` }}
              >
                <div
                  className="text-lg font-mono font-bold uppercase tracking-wider magi-glow"
                  style={{ color: config.color }}
                >
                  {unit.name}
                </div>
                <div className="text-sm font-mono text-text-dim mt-2 uppercase tracking-wider">
                  {unit.subtitle}
                </div>
                <div
                  className="text-sm font-mono mt-3 uppercase tracking-wider"
                  style={{ color: config.color, animation: "magi-pulse 3s infinite" }}
                >
                  {unit.status}
                </div>
              </div>
            );
          })()}
        </div>
        {/* Row 2: BALTHASAR-2 + CASPER-3 */}
        <div className="grid grid-cols-2 gap-6">
          {MAGI_UNITS.slice(1).map((unit) => {
            const config = ROLE_CONFIG[unit.key];
            return (
              <div
                key={unit.key}
                className="magi-frame bg-surface p-6 text-center w-[300px]"
                style={{ borderColor: `${config.color}40` }}
              >
                <div
                  className="text-lg font-mono font-bold uppercase tracking-wider magi-glow"
                  style={{ color: config.color }}
                >
                  {unit.name}
                </div>
                <div className="text-sm font-mono text-text-dim mt-2 uppercase tracking-wider">
                  {unit.subtitle}
                </div>
                <div
                  className="text-sm font-mono mt-3 uppercase tracking-wider"
                  style={{ color: config.color, animation: "magi-pulse 3s infinite" }}
                >
                  {unit.status}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskForm />
    </div>
  );
}

import { ProgressBar } from "@/components/ProgressBar";
import type { Quest } from "@/lib/types";

export function QuestCard({ quest }: { quest: Quest }) {
  return (
    <li
      className={`rounded-3xl border p-4 ${
        quest.completed ? "border-success/40 bg-success/5" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {quest.completed ? "✅ " : "🎯 "}
            {quest.title}
          </p>
          <p className="text-sm text-muted">{quest.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
          +{quest.reward_points}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <ProgressBar value={quest.progress} max={quest.target} label={`Progres ${quest.title}`} />
        </div>
        <span className="text-sm font-bold tabular-nums">
          {quest.progress}/{quest.target}
        </span>
      </div>
    </li>
  );
}

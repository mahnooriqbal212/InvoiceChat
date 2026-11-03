import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Paste chat", "Review", "Send"];

// Progress bar at the top of the new-invoice flow. `current` is 0, 1 or 2.
export default function Steps({ current }) {
  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-transparent bg-success text-background",
                active && "border-transparent bg-primary text-primary-foreground",
                !done && !active && "bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <span className={cn("hidden sm:inline", active ? "font-medium" : "text-muted-foreground")}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </li>
        );
      })}
    </ol>
  );
}

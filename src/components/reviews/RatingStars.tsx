import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  onChange,
  size = 16,
  className,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  className?: string;
}) {
  const readOnly = !onChange;
  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={cn("transition", !readOnly && "hover:scale-110", readOnly && "cursor-default")}
          >
            <Star
              style={{ width: size, height: size }}
              className={cn(filled ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/40")}
            />
          </button>
        );
      })}
    </div>
  );
}

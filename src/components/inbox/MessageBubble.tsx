import { formatRelative } from "@/lib/format";
import { Check, CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/inbox";

export function MessageBubble({ m, mine }: { m: Message; mine: boolean }) {
  if (m.kind === "system") {
    return (
      <div className="my-3 flex justify-center">
        <div className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-center max-w-md">
          {m.body}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className="max-w-[75%]">
        <div
          className={cn(
            "px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
            mine
              ? "bg-primary text-primary-foreground rounded-br-sm"
              : "bg-muted text-foreground rounded-bl-sm",
          )}
        >
          {m.body}
        </div>
        <div className={cn("mt-1 flex items-center gap-1 text-[10px] text-muted-foreground", mine ? "justify-end" : "justify-start")}>
          <span>{formatRelative(new Date(m.created_at).getTime())}</span>
          {mine && (m.read_at ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />)}
        </div>
      </div>
    </div>
  );
}

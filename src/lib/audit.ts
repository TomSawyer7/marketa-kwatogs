// Client-side audit logging helper. Fire-and-forget, batched.
import { supabase } from "@/integrations/supabase/client";

export type AuditEvent = {
  category: string;
  action: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  endpoint?: string;
  http_method?: string;
  status_code?: number;
  success?: boolean;
  failure_reason?: string;
  correlation_id?: string;
  metadata?: Record<string, unknown>;
};

const QUEUE: AuditEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 2000;
const MAX_BATCH = 20;

async function flush() {
  timer = null;
  if (QUEUE.length === 0) return;
  const events = QUEUE.splice(0, MAX_BATCH);
  try {
    await supabase.functions.invoke("audit-log", { body: { events } });
  } catch {
    // swallow — auditing must never affect UX
  }
  if (QUEUE.length > 0) schedule();
}

function schedule() {
  if (timer != null) return;
  timer = setTimeout(flush, FLUSH_MS);
}

export function logEvent(event: AuditEvent) {
  try {
    QUEUE.push({ success: true, ...event });
    if (QUEUE.length >= MAX_BATCH) {
      if (timer) { clearTimeout(timer); timer = null; }
      void flush();
    } else {
      schedule();
    }
  } catch {
    /* ignore */
  }
}

// Best-effort flush on tab close
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => { void flush(); });
}

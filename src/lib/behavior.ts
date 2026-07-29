import { supabase } from "@/integrations/supabase/client";

export type LockInfo = {
  locked: boolean;
  locked_until?: string;
  seconds_remaining?: number;
};

export async function checkLoginLock(email: string): Promise<LockInfo> {
  const { data } = await supabase.rpc("check_login_lock", { _email: email });
  return (data as LockInfo) ?? { locked: false };
}

export async function registerLoginAttempt(
  email: string,
  success: boolean,
  userId?: string | null,
): Promise<LockInfo> {
  const { data } = await supabase.rpc("register_login_attempt", {
    _email: email,
    _success: success,
    _user_id: userId ?? null,
  });
  return (data as LockInfo) ?? { locked: false };
}

export function formatLockDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.ceil(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.ceil(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}

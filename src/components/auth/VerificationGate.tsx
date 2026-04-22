import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

/**
 * Locks the entire marketplace behind verification.
 * - Not logged in: allowed routes are /auth and /verify (verify will redirect to /auth)
 * - Logged in + not verified: only /verify (and /admin if admin) accessible; everything else redirects to /verify
 * - Logged in + verified: pass-through
 */
const ALWAYS_ALLOWED = ["/", "/auth", "/forgot-password", "/reset-password"];
const VERIFY_PATH = "/verify";
const ADMIN_PATH = "/admin";

export function VerificationGate({ children }: { children: ReactNode }) {
  const { user, loading, isVerified, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const path = location.pathname;

  // Not logged in: let public marketplace pages render — Sell/Saved/etc. already protected by ProtectedRoute.
  if (!user) return <>{children}</>;

  // Admins bypass verification entirely
  if (isAdmin) {
    if (path === VERIFY_PATH) return <Navigate to={ADMIN_PATH} replace />;
    return <>{children}</>;
  }

  // Logged in but unverified
  if (!isVerified) {
    const allowed = path === VERIFY_PATH || ALWAYS_ALLOWED.includes(path);
    if (!allowed) return <Navigate to={VERIFY_PATH} replace />;
  }

  return <>{children}</>;
}

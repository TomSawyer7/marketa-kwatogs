import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useMpin } from "@/hooks/use-mpin";

/**
 * Locks the entire marketplace behind verification.
 * - Not logged in: allowed routes are /auth and /verify (verify will redirect to /auth)
 * - Logged in + not verified: only /verify (and /admin if admin) accessible; everything else redirects to /verify
 * - Logged in + verified but no MPIN: forced to /mpin-setup
 * - Logged in + verified + MPIN: pass-through
 */
const ALWAYS_ALLOWED = [
  "/",
  "/auth",
  "/forgot-password",
  "/verify-reset-password",
  "/create-new-password",
];
const VERIFY_PATH = "/verify";
const VERIFY_EMAIL_PATH = "/verify-email";
const MPIN_SETUP_PATH = "/mpin-setup";
const ADMIN_PATH = "/admin";

export function VerificationGate({ children }: { children: ReactNode }) {
  const { user, loading, isVerified, isAdmin, emailVerified } = useAuth();
  const { loading: mpinLoading, status: mpinStatus } = useMpin();
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
    if (path === VERIFY_PATH || path === VERIFY_EMAIL_PATH || path === MPIN_SETUP_PATH)
      return <Navigate to={ADMIN_PATH} replace />;
    return <>{children}</>;
  }

  // Logged in but email not confirmed → force email OTP step first
  if (!emailVerified) {
    const allowed = path === VERIFY_EMAIL_PATH || ALWAYS_ALLOWED.includes(path);
    if (!allowed) return <Navigate to={VERIFY_EMAIL_PATH} replace />;
    return <>{children}</>;
  }

  // Email verified but KYC not done
  if (!isVerified) {
    if (path === VERIFY_EMAIL_PATH) return <Navigate to={VERIFY_PATH} replace />;
    const allowed = path === VERIFY_PATH || ALWAYS_ALLOWED.includes(path);
    if (!allowed) return <Navigate to={VERIFY_PATH} replace />;
    return <>{children}</>;
  }

  // KYC verified → require a 6-digit MPIN before using the marketplace
  if (mpinLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (mpinStatus && !mpinStatus.has_mpin) {
    const allowed = path === MPIN_SETUP_PATH || ALWAYS_ALLOWED.includes(path);
    if (!allowed) return <Navigate to={MPIN_SETUP_PATH} replace />;
  } else if (path === MPIN_SETUP_PATH) {
    return <Navigate to="/browse" replace />;
  }

  return <>{children}</>;
}


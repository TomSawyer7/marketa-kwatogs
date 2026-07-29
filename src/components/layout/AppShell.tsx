import { ReactNode } from "react";
import { Header } from "./Header";
import { RestrictionBanner } from "./RestrictionBanner";
import { AccountLifecycleBanner } from "@/components/account/AccountLifecycleBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <AccountLifecycleBanner />
      <RestrictionBanner />
      <main className="min-w-0">{children}</main>
    </div>
  );
}

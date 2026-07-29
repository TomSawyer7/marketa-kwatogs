import { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { RestrictionBanner } from "./RestrictionBanner";
import { AccountLifecycleBanner } from "@/components/account/AccountLifecycleBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <AccountLifecycleBanner />
      <RestrictionBanner />
      <main className="min-w-0 flex-1">{children}</main>
      <Footer />
    </div>
  );
}

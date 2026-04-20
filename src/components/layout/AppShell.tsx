import { ReactNode } from "react";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="min-w-0">{children}</main>
    </div>
  );
}

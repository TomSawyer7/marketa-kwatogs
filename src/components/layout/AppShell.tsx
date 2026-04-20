import { ReactNode } from "react";
import { Header } from "./Header";
import { CategorySidebar } from "./CategorySidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <CategorySidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { CATEGORIES } from "@/lib/categories";
import { Bookmark, Plus, Store, User, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  { to: "/", label: "Browse all", icon: Store, end: true },
  { to: "/sell", label: "Sell something", icon: Plus },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Your profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function CategorySidebar() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeCat = params.get("cat") ?? "all";

  return (
    <aside className="hidden md:flex w-64 lg:w-72 shrink-0 sticky top-[var(--header-h)] h-[calc(100dvh-var(--header-h))] flex-col border-r border-border bg-card">
      <div className="px-4 py-4 border-b border-border">
        <h1 className="text-xl font-bold">Marketplace</h1>
      </div>

      <nav className="px-2 py-3 overflow-y-auto scrollbar-thin">
        <ul className="space-y-0.5">
          {SHORTCUTS.map((s) => (
            <li key={s.to}>
              <NavLink
                to={s.to}
                end={s.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition",
                    isActive
                      ? "bg-primary-soft text-primary"
                      : "text-foreground hover:bg-secondary",
                  )
                }
              >
                <span className="h-8 w-8 grid place-items-center rounded-full bg-secondary">
                  <s.icon className="h-4 w-4" />
                </span>
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="mt-5 px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Categories
        </div>
        <ul className="space-y-0.5">
          {CATEGORIES.map((c) => {
            const isActive = location.pathname === "/" && activeCat === c.slug;
            return (
              <li key={c.slug}>
                <NavLink
                  to={`/?cat=${c.slug}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition",
                    isActive
                      ? "bg-primary-soft text-primary font-semibold"
                      : "text-foreground hover:bg-secondary",
                  )}
                >
                  <c.icon className="h-4 w-4 text-muted-foreground" />
                  {c.name}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

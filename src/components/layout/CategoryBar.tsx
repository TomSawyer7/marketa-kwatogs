import { NavLink, useLocation } from "react-router-dom";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

// Friendly emoji per category — matches the reference design
const CATEGORY_EMOJI: Record<string, string> = {
  all: "▦",
  vehicles: "🚗",
  property: "🏠",
  home: "🛋️",
  clothing: "👗",
  electronics: "📱",
  games: "🎮",
  sports: "⚽",
  baby: "🍼",
  pets: "🐶",
  tools: "🛠️",
  books: "📚",
  music: "🎸",
  fitness: "🏋️",
};

export function CategoryBar() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const activeCat = location.pathname === "/browse" ? params.get("cat") ?? "all" : "";

  return (
    <nav
      aria-label="Categories"
      className="border-t border-border bg-card"
    >
      <div className="px-3 md:px-5 py-2 overflow-x-auto scrollbar-thin">
        <ul className="flex items-center gap-2 min-w-max">
          {CATEGORIES.map((c) => {
            const isActive = activeCat === c.slug;
            const label = c.slug === "all" ? "All" : c.name;
            return (
              <li key={c.slug}>
                <NavLink
                  to={`/browse?cat=${c.slug}`}
                  className={cn(
                    "inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-medium border transition whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-secondary",
                  )}
                >
                  <span aria-hidden className="text-base leading-none">
                    {CATEGORY_EMOJI[c.slug] ?? "•"}
                  </span>
                  {label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

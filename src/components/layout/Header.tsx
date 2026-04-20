import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Search, Plus, Bookmark, User, Bell, MessageCircle, Store,
  Home as HomeIcon, LayoutGrid, UserCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMarketa } from "@/store/marketa";
import { useState, FormEvent } from "react";
import { cn } from "@/lib/utils";

const NAV_TABS = [
  { to: "/", label: "Home", icon: HomeIcon, end: true },
  { to: "/?cat=all", label: "Marketplace", icon: LayoutGrid, match: ["/"] },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/sell", label: "Sell", icon: Plus },
  { to: "/profile", label: "Profile", icon: UserCircle2 },
] as const;

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useMarketa();
  const [q, setQ] = useState("");

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      <div className="h-[var(--header-h)] px-3 md:px-5 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        {/* Left: brand + search */}
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
              <Store className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:inline">Marketa</span>
          </Link>

          <form onSubmit={onSearch} className="hidden md:block w-56 lg:w-72">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Marketa"
                className="pl-9 bg-secondary border-transparent rounded-full h-10 focus-visible:bg-card"
              />
            </div>
          </form>
        </div>

        {/* Center: main nav tabs */}
        <nav aria-label="Main" className="hidden md:flex justify-center">
          <ul className="flex items-center gap-1 lg:gap-2">
            {NAV_TABS.map((tab) => {
              const isHome = tab.to === "/";
              const isMarketplace = tab.label === "Marketplace";
              // Marketplace also highlights for /item/:id and category-filtered home
              const matchesItem = isMarketplace && location.pathname.startsWith("/item/");
              return (
                <li key={tab.label}>
                  <NavLink
                    to={tab.to}
                    end={isHome}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center justify-center h-12 w-20 lg:w-28 rounded-md transition group",
                        "text-muted-foreground hover:bg-secondary",
                        (isActive || matchesItem) && "text-primary",
                      )
                    }
                    aria-label={tab.label}
                  >
                    {({ isActive }) => {
                      const active = isActive || matchesItem;
                      return (
                        <>
                          <tab.icon className={cn("h-6 w-6 transition", active && "text-primary")} />
                          <span className="sr-only lg:not-sr-only lg:ml-2 lg:text-sm lg:font-medium">{tab.label}</span>
                          <span
                            className={cn(
                              "absolute left-2 right-2 -bottom-px h-[3px] rounded-full bg-primary transition-opacity",
                              active ? "opacity-100" : "opacity-0",
                            )}
                          />
                        </>
                      );
                    }}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-1 sm:gap-2 justify-end">
          <Button asChild variant="default" size="sm" className="rounded-full gap-1.5 hidden md:hidden">
            <Link to="/sell"><Plus className="h-4 w-4" />Sell</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Sell">
            <Link to="/sell"><Plus className="h-5 w-5" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full md:hidden" aria-label="Saved">
            <Link to="/saved"><Bookmark className="h-5 w-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full hidden sm:inline-flex" aria-label="Messages">
            <MessageCircle className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-full hidden sm:inline-flex" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </Button>
          <Link to="/profile" aria-label="Profile" className="ml-1">
            <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-primary transition">
              <AvatarImage src={profile.avatar} alt={profile.name} />
              <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </div>

      {/* Mobile: search + horizontal nav row under the header */}
      <div className="md:hidden border-t border-border bg-card px-2 py-2 flex items-center gap-2">
        <form onSubmit={onSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Marketa"
              className="pl-9 bg-secondary border-transparent rounded-full h-9 focus-visible:bg-card"
            />
          </div>
        </form>
      </div>
      <nav aria-label="Main mobile" className="md:hidden border-t border-border bg-card">
        <ul className="grid grid-cols-5">
          {NAV_TABS.map((tab) => (
            <li key={tab.label}>
              <NavLink
                to={tab.to}
                end={tab.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-0.5 h-12 text-[11px] transition",
                    isActive
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground border-b-2 border-transparent",
                  )
                }
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

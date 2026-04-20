import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Bookmark, User, Bell, MessageCircle, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useMarketa } from "@/store/marketa";
import { useState, FormEvent } from "react";

export function Header() {
  const navigate = useNavigate();
  const { profile } = useMarketa();
  const [q, setQ] = useState("");

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 h-[var(--header-h)] bg-card border-b border-border">
      <div className="h-full px-3 md:px-5 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:inline">Marketa</span>
        </Link>

        <form onSubmit={onSearch} className="flex-1 max-w-xl mx-auto">
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

        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="default" size="sm" className="rounded-full gap-1.5 hidden sm:inline-flex">
            <Link to="/sell"><Plus className="h-4 w-4" />Sell</Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full sm:hidden" aria-label="Sell">
            <Link to="/sell"><Plus className="h-5 w-5" /></Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Saved">
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
    </header>
  );
}

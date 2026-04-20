import { Link, useNavigate } from "react-router-dom";
import { Search, Plus, Bookmark, User, MessageCircle, Store, LogOut, Settings as SettingsIcon, UserCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarketa } from "@/store/marketa";
import { useAuth } from "@/hooks/use-auth";
import { useState, FormEvent } from "react";
import { toast } from "sonner";
import { CategoryBar } from "./CategoryBar";

export function Header() {
  const navigate = useNavigate();
  const { profile } = useMarketa();
  const { user, isAdmin, signOut } = useAuth();
  const [q, setQ] = useState("");

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(q.trim())}`);
  };

  const handleSell = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      navigate("/auth", { state: { from: "/sell" } });
    }
  };

  const handleSaved = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      navigate("/auth", { state: { from: "/saved" } });
    }
  };

  const onLogout = async () => {
    await signOut();
    toast.success("Logged out");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-40 bg-card border-b border-border">
      {/* Top bar */}
      <div className="h-[var(--header-h)] px-3 md:px-5 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:inline">Marketa</span>
        </Link>

        <form onSubmit={onSearch} className="flex-1 max-w-xl">
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

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <Button
            variant="ghost"
            className="rounded-md h-12 px-3 hidden sm:flex flex-col gap-0.5 items-center text-muted-foreground hover:text-foreground"
            aria-label="Inbox"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Inbox</span>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="rounded-md h-12 px-3 hidden sm:flex flex-col gap-0.5 items-center text-muted-foreground hover:text-foreground"
            aria-label="Saved"
          >
            <Link to="/saved" onClick={handleSaved}>
              <Bookmark className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">Saved</span>
            </Link>
          </Button>

          <Button asChild variant="default" size="sm" className="rounded-full gap-1.5 h-10 px-4">
            <Link to="/sell" onClick={handleSell}><Plus className="h-4 w-4" />Sell</Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button aria-label="Account menu" className="ml-1 rounded-full">
                  <Avatar className="h-9 w-9 ring-2 ring-transparent hover:ring-primary transition">
                    <AvatarImage src={profile.avatar} alt={profile.name} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span className="font-semibold truncate">{profile.name}</span>
                  <span className="text-xs font-normal text-muted-foreground truncate">{user.email}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <UserCircle className="h-4 w-4 mr-2" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="cursor-pointer">
                    <SettingsIcon className="h-4 w-4 mr-2" /> Settings
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="cursor-pointer">
                      <ShieldCheck className="h-4 w-4 mr-2" /> Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm" className="rounded-full h-10 px-4 ml-1">
              <Link to="/auth">Log in</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Category pill row */}
      <CategoryBar />
    </header>
  );
}

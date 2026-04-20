import { createContext, useContext, useMemo, ReactNode, useCallback } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { SEED_LISTINGS, SELLERS } from "@/lib/seed";
import type { Listing, Seller } from "@/lib/types";

type Profile = {
  name: string;
  email: string;
  location: string;
  bio: string;
  avatar: string;
  notifications: { messages: boolean; deals: boolean; newsletter: boolean };
  visibility: "public" | "private";
};

const DEFAULT_PROFILE: Profile = {
  name: "You",
  email: "you@marketa.app",
  location: "Brooklyn, NY",
  bio: "Casual seller — clearing space.",
  avatar: "https://api.dicebear.com/7.x/initials/svg?seed=You&backgroundColor=1877f2",
  notifications: { messages: true, deals: true, newsletter: false },
  visibility: "public",
};

type Ctx = {
  listings: Listing[];
  myListings: Listing[];
  saved: string[];
  profile: Profile;
  sellers: Seller[];
  getSeller: (id: string) => Seller | undefined;
  getListing: (id: string) => Listing | undefined;
  toggleSave: (id: string) => void;
  isSaved: (id: string) => boolean;
  addListing: (l: Omit<Listing, "id" | "sellerId" | "createdAt">) => Listing;
  updateListing: (id: string, patch: Partial<Listing>) => void;
  deleteListing: (id: string) => void;
  updateProfile: (p: Partial<Profile>) => void;
};

const MarketaContext = createContext<Ctx | null>(null);

export function MarketaProvider({ children }: { children: ReactNode }) {
  const [userListings, setUserListings] = useLocalStorage<Listing[]>("marketa.userListings", []);
  const [saved, setSaved] = useLocalStorage<string[]>("marketa.saved", []);
  const [profile, setProfile] = useLocalStorage<Profile>("marketa.profile", DEFAULT_PROFILE);

  const sellers = useMemo<Seller[]>(() => {
    return SELLERS.map((s) =>
      s.id === "u_me"
        ? { ...s, name: profile.name, avatar: profile.avatar, location: profile.location, bio: profile.bio }
        : s,
    );
  }, [profile]);

  const listings = useMemo<Listing[]>(
    () => [...userListings, ...SEED_LISTINGS],
    [userListings],
  );

  const myListings = useMemo(() => userListings.slice().sort((a, b) => b.createdAt - a.createdAt), [userListings]);

  const getSeller = useCallback((id: string) => sellers.find((s) => s.id === id), [sellers]);
  const getListing = useCallback((id: string) => listings.find((l) => l.id === id), [listings]);

  const toggleSave = useCallback((id: string) => {
    setSaved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]));
  }, [setSaved]);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  const addListing: Ctx["addListing"] = useCallback((l) => {
    const newListing: Listing = {
      ...l,
      id: `my_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      sellerId: "u_me",
      createdAt: Date.now(),
    };
    setUserListings((prev) => [newListing, ...prev]);
    return newListing;
  }, [setUserListings]);

  const updateListing: Ctx["updateListing"] = useCallback((id, patch) => {
    setUserListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }, [setUserListings]);

  const deleteListing: Ctx["deleteListing"] = useCallback((id) => {
    setUserListings((prev) => prev.filter((l) => l.id !== id));
    setSaved((prev) => prev.filter((s) => s !== id));
  }, [setUserListings, setSaved]);

  const updateProfile: Ctx["updateProfile"] = useCallback((p) => {
    setProfile((prev) => ({ ...prev, ...p, notifications: { ...prev.notifications, ...(p.notifications ?? {}) } }));
  }, [setProfile]);

  const value: Ctx = {
    listings, myListings, saved, profile, sellers,
    getSeller, getListing, toggleSave, isSaved,
    addListing, updateListing, deleteListing, updateProfile,
  };

  return <MarketaContext.Provider value={value}>{children}</MarketaContext.Provider>;
}

export function useMarketa() {
  const ctx = useContext(MarketaContext);
  if (!ctx) throw new Error("useMarketa must be used within MarketaProvider");
  return ctx;
}

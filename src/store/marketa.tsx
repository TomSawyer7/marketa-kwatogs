import { createContext, useContext, useMemo, ReactNode, useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { SEED_LISTINGS, SELLERS } from "@/lib/seed";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  location: "Makati, Metro Manila",
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
  const { user } = useAuth();
  const [userListings, setUserListings] = useLocalStorage<Listing[]>("marketa.userListings", []);
  const [saved, setSaved] = useLocalStorage<string[]>("marketa.saved", []);
  const [localProfile, setLocalProfile] = useLocalStorage<Profile>("marketa.profile", DEFAULT_PROFILE);
  const [remoteProfile, setRemoteProfile] = useState<Profile | null>(null);

  // Hydrate profile from Supabase when logged in
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRemoteProfile(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, email, location, bio, avatar_url, visibility, notifications")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        // Fall back to auth metadata if the profiles row isn't there yet (table not created)
        const meta = (user.user_metadata ?? {}) as { name?: string };
        setRemoteProfile({
          ...DEFAULT_PROFILE,
          name: meta.name ?? user.email?.split("@")[0] ?? "You",
          email: user.email ?? "",
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(meta.name ?? user.email ?? "You")}&backgroundColor=1877f2`,
        });
        return;
      }
      setRemoteProfile({
        name: data.name ?? user.email?.split("@")[0] ?? "You",
        email: data.email ?? user.email ?? "",
        location: data.location ?? DEFAULT_PROFILE.location,
        bio: data.bio ?? "",
        avatar: data.avatar_url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(data.name ?? user.email ?? "You")}&backgroundColor=1877f2`,
        notifications: (data.notifications as Profile["notifications"]) ?? DEFAULT_PROFILE.notifications,
        visibility: (data.visibility as Profile["visibility"]) ?? "public",
      });
    })();
    return () => { cancelled = true; };
  }, [user]);

  const profile = remoteProfile ?? localProfile;

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
    if (user) {
      // Update local mirror immediately for snappy UI
      setRemoteProfile((prev) => {
        const base = prev ?? DEFAULT_PROFILE;
        return { ...base, ...p, notifications: { ...base.notifications, ...(p.notifications ?? {}) } };
      });
      // Persist to Supabase (best-effort; ignored if profiles table not yet created)
      const next = {
        name: p.name,
        email: p.email,
        location: p.location,
        bio: p.bio,
        avatar_url: p.avatar,
        visibility: p.visibility,
        notifications: p.notifications,
        updated_at: new Date().toISOString(),
      };
      // Strip undefined keys
      const payload = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined));
      supabase.from("profiles").update(payload).eq("id", user.id).then(({ error }) => {
        if (error) console.warn("[marketa] profile update skipped:", error.message);
      });
    } else {
      setLocalProfile((prev) => ({
        ...prev, ...p, notifications: { ...prev.notifications, ...(p.notifications ?? {}) },
      }));
    }
  }, [user, setLocalProfile]);

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

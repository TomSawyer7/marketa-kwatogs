import { createContext, useContext, useMemo, ReactNode, useCallback, useEffect, useState } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { SEED_LISTINGS, SELLERS } from "@/lib/seed";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { Listing, Seller } from "@/lib/types";
import type { Database } from "@/integrations/supabase/types";

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
  currentUserId: string | null;
  loadingListings: boolean;
  getSeller: (id: string) => Seller | undefined;
  getListing: (id: string) => Listing | undefined;
  toggleSave: (id: string) => Promise<void>;
  isSaved: (id: string) => boolean;
  addListing: (l: Omit<Listing, "id" | "sellerId" | "createdAt">) => Promise<Listing | null>;
  updateListing: (id: string, patch: Partial<Listing>) => Promise<void>;
  deleteListing: (id: string) => Promise<void>;
  updateProfile: (p: Partial<Profile>) => Promise<void>;
};

const MarketaContext = createContext<Ctx | null>(null);

type DbListing = {
  id: string;
  seller_id: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  location: string;
  price: number;
  images: string[];
  created_at: string;
};

const fromDb = (r: DbListing): Listing => ({
  id: r.id,
  sellerId: r.seller_id,
  title: r.title,
  description: r.description,
  category: r.category,
  condition: r.condition as Listing["condition"],
  location: r.location,
  price: Number(r.price),
  images: r.images ?? [],
  createdAt: new Date(r.created_at).getTime(),
});

export function MarketaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [localProfile, setLocalProfile] = useLocalStorage<Profile>("marketa.profile", DEFAULT_PROFILE);
  const [remoteProfile, setRemoteProfile] = useState<Profile | null>(null);

  const [dbListings, setDbListings] = useState<Listing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [saved, setSaved] = useState<string[]>([]);

  // ---- Profiles ----
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

  // ---- Listings (from Supabase) ----
  const refreshListings = useCallback(async () => {
    setLoadingListings(true);
    const { data, error } = await supabase
      .from("listings")
      .select("id, seller_id, title, description, category, condition, location, price, images, created_at, archived_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[marketa] listings load failed:", error.message);
      setDbListings([]);
      setArchivedIds(new Set());
    } else {
      const rows = data as DbListing[];
      setDbListings(rows.map(fromDb));
      setArchivedIds(new Set(rows.filter((r) => r.archived_at).map((r) => r.id)));
    }
    setLoadingListings(false);
  }, []);

  useEffect(() => {
    refreshListings();
  }, [refreshListings]);

  // ---- Saved listings (from Supabase) ----
  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSaved([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", user.id);
      if (cancelled) return;
      if (error) {
        console.warn("[marketa] saved load failed:", error.message);
        setSaved([]);
      } else {
        setSaved(data.map((r) => r.listing_id));
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // ---- Derived data ----
  const sellers = useMemo<Seller[]>(() => {
    const base = SELLERS.map((s) =>
      s.id === "u_me"
        ? { ...s, name: profile.name, avatar: profile.avatar, location: profile.location, bio: profile.bio }
        : s,
    );
    if (user) {
      // Inject the real user as a seller so their listings resolve a seller card.
      const exists = base.find((s) => s.id === user.id);
      if (!exists) {
        base.unshift({
          id: user.id,
          name: profile.name,
          avatar: profile.avatar,
          joinedAt: new Date(user.created_at ?? Date.now()).getTime(),
          location: profile.location,
          bio: profile.bio,
          rating: 5.0,
        });
      }
    }
    return base;
  }, [profile, user]);

  // Merge DB listings + read-only seed listings (seed first sorted in)
  const listings = useMemo<Listing[]>(() => {
    // Listings belonging to deactivated / pending-deletion accounts are archived
    // server-side and must never surface in the public feed.
    const visible = dbListings.filter((l) => !archivedIds.has(l.id));
    return [...visible, ...SEED_LISTINGS].sort((a, b) => b.createdAt - a.createdAt);
  }, [dbListings, archivedIds]);

  const myListings = useMemo(
    () => (user ? dbListings.filter((l) => l.sellerId === user.id) : []),
    [dbListings, user],
  );

  const getSeller = useCallback((id: string) => sellers.find((s) => s.id === id), [sellers]);
  const getListing = useCallback((id: string) => listings.find((l) => l.id === id), [listings]);

  // ---- Saved ops ----
  const toggleSave = useCallback(async (id: string) => {
    if (!user) {
      toast.error("Log in to save listings");
      return;
    }
    const already = saved.includes(id);
    // optimistic
    setSaved((prev) => (already ? prev.filter((x) => x !== id) : [id, ...prev]));
    if (already) {
      const { error } = await supabase
        .from("saved_listings")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", id);
      if (error) {
        toast.error("Couldn't unsave: " + error.message);
        setSaved((prev) => [id, ...prev]);
      }
    } else {
      const { error } = await supabase
        .from("saved_listings")
        .insert({ user_id: user.id, listing_id: id });
      if (error) {
        toast.error("Couldn't save: " + error.message);
        setSaved((prev) => prev.filter((x) => x !== id));
      }
    }
  }, [user, saved]);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  // ---- Listing CRUD ----
  const addListing: Ctx["addListing"] = useCallback(async (l) => {
    if (!user) {
      toast.error("Log in to create a listing");
      return null;
    }
    const { data, error } = await supabase
      .from("listings")
      .insert({
        seller_id: user.id,
        title: l.title,
        description: l.description,
        category: l.category,
        condition: l.condition,
        location: l.location,
        price: l.price,
        images: l.images,
      })
      .select("id, seller_id, title, description, category, condition, location, price, images, created_at")
      .single();

    if (error || !data) {
      toast.error("Couldn't publish: " + (error?.message ?? "unknown error"));
      return null;
    }
    const created = fromDb(data as DbListing);
    setDbListings((prev) => [created, ...prev]);
    return created;
  }, [user]);

  const updateListing: Ctx["updateListing"] = useCallback(async (id, patch) => {
    if (!user) return;
    const dbPatch: Database["public"]["Tables"]["listings"]["Update"] = {};
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.condition !== undefined) dbPatch.condition = patch.condition;
    if (patch.location !== undefined) dbPatch.location = patch.location;
    if (patch.price !== undefined) dbPatch.price = patch.price;
    if (patch.images !== undefined) dbPatch.images = patch.images;

    const { data, error } = await supabase
      .from("listings")
      .update(dbPatch)
      .eq("id", id)
      .eq("seller_id", user.id)
      .select("id, seller_id, title, description, category, condition, location, price, images, created_at")
      .single();

    if (error || !data) {
      toast.error("Couldn't update: " + (error?.message ?? "unknown"));
      return;
    }
    const updated = fromDb(data as DbListing);
    setDbListings((prev) => prev.map((l) => (l.id === id ? updated : l)));
  }, [user]);

  const deleteListing: Ctx["deleteListing"] = useCallback(async (id) => {
    if (!user) return;
    const { error } = await supabase
      .from("listings")
      .delete()
      .eq("id", id)
      .eq("seller_id", user.id);
    if (error) {
      toast.error("Couldn't delete: " + error.message);
      return;
    }
    setDbListings((prev) => prev.filter((l) => l.id !== id));
    setSaved((prev) => prev.filter((s) => s !== id));
  }, [user]);

  // ---- Profile update ----
  const updateProfile: Ctx["updateProfile"] = useCallback(async (p) => {
    if (user) {
      setRemoteProfile((prev) => {
        const base = prev ?? DEFAULT_PROFILE;
        return { ...base, ...p, name: base.name, notifications: { ...base.notifications, ...(p.notifications ?? {}) } };
      });
      const next: Database["public"]["Tables"]["profiles"]["Update"] = {
        // display name is locked to the KYC-verified name; never written from the client

        email: p.email,
        location: p.location,
        bio: p.bio,
        avatar_url: p.avatar,
        visibility: p.visibility,
        notifications: p.notifications,
        updated_at: new Date().toISOString(),
      };
      const payload = Object.fromEntries(
        Object.entries(next).filter(([, v]) => v !== undefined),
      ) as Database["public"]["Tables"]["profiles"]["Update"];
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) {
        toast.error("Couldn't save profile: " + error.message);
      }
    } else {
      setLocalProfile((prev) => ({
        ...prev, ...p, notifications: { ...prev.notifications, ...(p.notifications ?? {}) },
      }));
    }
  }, [user, setLocalProfile]);

  const value: Ctx = {
    listings, myListings, saved, profile, sellers,
    currentUserId: user?.id ?? null,
    loadingListings,
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

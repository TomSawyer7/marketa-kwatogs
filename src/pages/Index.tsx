import { useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ListingCard } from "@/components/marketa/ListingCard";
import { EmptyState } from "@/components/marketa/EmptyState";
import { CATEGORIES } from "@/lib/categories";
import { useMarketa } from "@/store/marketa";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const Index = () => {
  const { listings } = useMarketa();
  const [params, setParams] = useSearchParams();

  const q = params.get("q") ?? "";
  const cat = params.get("cat") ?? "all";
  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";
  const loc = params.get("loc") ?? "";

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const clearFilters = () => {
    const p = new URLSearchParams(params);
    ["min", "max", "loc"].forEach((k) => p.delete(k));
    setParams(p, { replace: true });
  };

  const results = useMemo(() => {
    const min = minPrice ? Number(minPrice) : -Infinity;
    const max = maxPrice ? Number(maxPrice) : Infinity;
    const qNorm = q.trim().toLowerCase();
    const locNorm = loc.trim().toLowerCase();
    return listings
      .filter((l) => (cat === "all" ? true : l.category === cat))
      .filter((l) => l.price >= min && l.price <= max)
      .filter((l) => (locNorm ? l.location.toLowerCase().includes(locNorm) : true))
      .filter((l) =>
        qNorm
          ? l.title.toLowerCase().includes(qNorm) || l.description.toLowerCase().includes(qNorm)
          : true,
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [listings, cat, minPrice, maxPrice, loc, q]);

  const activeCategory = CATEGORIES.find((c) => c.slug === cat) ?? CATEGORIES[0];
  const heading = cat === "all" ? "Today's picks" : activeCategory.name;
  const activeFilterCount = [minPrice, maxPrice, loc].filter(Boolean).length;

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6">
        <div className="flex items-end justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{heading}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {results.length} {results.length === 1 ? "item" : "items"}
              {q && <> · "<span className="text-foreground font-medium">{q}</span>"</>}
            </p>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full gap-2 h-10">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    className={cn(
                      "ml-1 h-5 min-w-5 px-1.5 grid place-items-center rounded-full",
                      "bg-primary text-primary-foreground text-xs font-semibold",
                    )}
                  >
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Location</h3>
              </div>
              <Input
                placeholder="City, state"
                value={loc}
                onChange={(e) => setParam("loc", e.target.value)}
              />

              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Price</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    type="number" inputMode="numeric" placeholder="Min"
                    value={minPrice} onChange={(e) => setParam("min", e.target.value)}
                  />
                  <Input
                    type="number" inputMode="numeric" placeholder="Max"
                    value={maxPrice} onChange={(e) => setParam("max", e.target.value)}
                  />
                </div>
              </div>

              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No listings found"
            description="Try adjusting your search, category, or filters."
            action={<Button asChild variant="outline"><Link to="/">Reset</Link></Button>}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {results.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default Index;

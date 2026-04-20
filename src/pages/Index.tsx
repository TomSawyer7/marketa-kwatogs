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
import { Search, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const FiltersPanel = ({
  minPrice, maxPrice, location, onChange, onClear,
}: {
  minPrice: string; maxPrice: string; location: string;
  onChange: (k: "minPrice" | "maxPrice" | "loc", v: string) => void;
  onClear: () => void;
}) => (
  <div className="space-y-4">
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Price</Label>
      <div className="flex gap-2 mt-1.5">
        <Input
          type="number" inputMode="numeric" placeholder="Min"
          value={minPrice} onChange={(e) => onChange("minPrice", e.target.value)}
        />
        <Input
          type="number" inputMode="numeric" placeholder="Max"
          value={maxPrice} onChange={(e) => onChange("maxPrice", e.target.value)}
        />
      </div>
    </div>
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location</Label>
      <Input
        placeholder="City, state"
        className="mt-1.5"
        value={location} onChange={(e) => onChange("loc", e.target.value)}
      />
    </div>
    <Button variant="outline" size="sm" onClick={onClear} className="w-full">Clear filters</Button>
  </div>
);

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

  const onFilterChange = (k: "minPrice" | "maxPrice" | "loc", v: string) => {
    const map = { minPrice: "min", maxPrice: "max", loc: "loc" } as const;
    setParam(map[k], v);
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

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6">
        {/* Header strip */}
        <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-6 mb-5">
          <div className="min-w-0">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{activeCategory.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {results.length} {results.length === 1 ? "item" : "items"}
              {q && <> matching “<span className="text-foreground font-medium">{q}</span>”</>}
            </p>
          </div>

          <div className="md:ml-auto flex items-center gap-2 flex-wrap">
            {/* Mobile search (header search is the main one) */}
            <div className="relative md:hidden w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search Marketa"
                value={q}
                onChange={(e) => setParam("q", e.target.value)}
                className="pl-9 rounded-full"
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full gap-2 md:hidden">
                  <SlidersHorizontal className="h-4 w-4" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                <div className="mt-6">
                  <FiltersPanel
                    minPrice={minPrice} maxPrice={maxPrice} location={loc}
                    onChange={onFilterChange} onClear={clearFilters}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6">
          {/* Results */}
          <section>
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
          </section>

          {/* Filters (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--header-h)+1rem)] bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Filters</h3>
              </div>
              <FiltersPanel
                minPrice={minPrice} maxPrice={maxPrice} location={loc}
                onChange={onFilterChange} onClear={clearFilters}
              />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
};

export default Index;

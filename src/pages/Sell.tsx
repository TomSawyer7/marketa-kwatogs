import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/categories";
import { useMarketa } from "@/store/marketa";
import { Camera, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import type { Condition } from "@/lib/types";

const CONDITIONS: Condition[] = ["New", "Used - Like New", "Used - Good", "Used - Fair"];

const sellSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100),
  price: z.number({ invalid_type_error: "Price is required" }).min(0, "Price must be 0 or more").max(1_000_000, "Price too high"),
  category: z.string().min(1, "Pick a category").refine((v) => v !== "all", "Pick a specific category"),
  condition: z.enum(["New", "Used - Like New", "Used - Good", "Used - Fair"]),
  location: z.string().trim().min(2, "Location is required").max(80),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000),
  images: z.array(z.string()).min(1, "Add at least one photo").max(8, "Up to 8 photos"),
});

const Sell = () => {
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const navigate = useNavigate();
  const { getListing, addListing, updateListing, profile } = useMarketa();
  const editing = editId ? getListing(editId) : undefined;
  const isEditing = Boolean(editing && editing.sellerId === "u_me");

  const initial = useMemo(() => ({
    title: editing?.title ?? "",
    price: editing?.price?.toString() ?? "",
    category: editing?.category ?? "",
    condition: (editing?.condition as Condition) ?? "Used - Good",
    location: editing?.location ?? profile.location,
    description: editing?.description ?? "",
    images: editing?.images ?? ([] as string[]),
  }), [editing, profile.location]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { setForm(initial); }, [initial]);

  const setField = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 8 - form.images.length;
    const toRead = files.slice(0, remaining);
    if (files.length > remaining) toast.warning(`Only added ${remaining} more photos (max 8 total).`);

    const reads = await Promise.all(
      toRead.map(
        (f) => new Promise<string>((resolve, reject) => {
          if (!f.type.startsWith("image/")) return reject(new Error("Not an image"));
          if (f.size > 4 * 1024 * 1024) return reject(new Error("Image too large (max 4MB)"));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(f);
        }).catch((err) => { toast.error(err.message); return ""; }),
      ),
    );
    const valid = reads.filter(Boolean);
    setField("images", [...form.images, ...valid]);
    e.target.value = "";
  };

  const removeImage = (i: number) => setField("images", form.images.filter((_, idx) => idx !== i));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = sellSchema.safeParse({
      title: form.title,
      price: form.price === "" ? Number.NaN : Number(form.price),
      category: form.category,
      condition: form.condition,
      location: form.location,
      description: form.description,
      images: form.images,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as string;
        if (!fieldErrors[k]) fieldErrors[k] = iss.message;
      });
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const data = {
      title: parsed.data.title,
      price: parsed.data.price,
      category: parsed.data.category,
      condition: parsed.data.condition as Condition,
      location: parsed.data.location,
      description: parsed.data.description,
      images: parsed.data.images,
    };

    if (isEditing && editing) {
      updateListing(editing.id, data);
      toast.success("Listing updated");
      navigate(`/item/${editing.id}`);
    } else {
      const created = addListing(data);
      toast.success("Listing published");
      navigate(`/item/${created.id}`);
    }
  };

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
          {isEditing ? "Edit listing" : "Create new listing"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isEditing ? "Update the details below." : "Add photos and details to publish your item to Marketa."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5 bg-card border border-border rounded-lg p-5 md:p-6">
          {/* Photos */}
          <div>
            <Label>Photos <span className="text-muted-foreground font-normal">(up to 8)</span></Label>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {form.images.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-secondary">
                  <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-card/90 grid place-items-center hover:bg-card"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {form.images.length < 8 && (
                <label className="aspect-square rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary cursor-pointer transition">
                  <Camera className="h-5 w-5" />
                  <span className="text-xs">Add photo</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
                </label>
              )}
            </div>
            {errors.images && <p className="text-xs text-destructive mt-1.5">{errors.images}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title" value={form.title} maxLength={100}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="e.g. Vintage leather jacket — size M"
              />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
            </div>
            <div>
              <Label htmlFor="price">Price (PHP)</Label>
              <Input
                id="price" type="number" inputMode="numeric" min={0} value={form.price}
                onChange={(e) => setField("price", e.target.value)}
                placeholder="0"
              />
              {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setField("category", v)}>
                <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.slug !== "all").map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive mt-1">{errors.category}</p>}
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={form.condition} onValueChange={(v) => setField("condition", v as Condition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location" value={form.location} maxLength={80}
                onChange={(e) => setField("location", e.target.value)}
                placeholder="City, State"
              />
              {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description" rows={5} maxLength={2000} value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Describe the item, its condition, and any details buyers should know."
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button asChild type="button" variant="outline"><Link to="/profile">Cancel</Link></Button>
            <Button type="submit" className="gap-2">
              {isEditing ? "Save changes" : "Publish listing"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
};

export default Sell;

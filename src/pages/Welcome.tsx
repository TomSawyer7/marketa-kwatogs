import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Search, ShoppingBag, Store, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const steps = [
  {
    title: "Post",
    description: "List an item with clear photos, a price, description, and the right category.",
    icon: Upload,
  },
  {
    title: "Browse",
    description: "Find great items with search, filters, categories, and your saved favorites.",
    icon: Search,
  },
  {
    title: "Buy",
    description: "Message the seller, agree on the exchange, follow its status, and confirm when it is complete.",
    icon: ShoppingBag,
  },
];

const Welcome = () => {
  const navigate = useNavigate();
  const { user, firstName, refreshStatus } = useAuth();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Welcome to Marketa";
  }, []);

  const greetingName = useMemo(() => {
    const metadata = user?.user_metadata as { first_name?: string; name?: string } | undefined;
    const fallback = metadata?.first_name ?? metadata?.name?.trim().split(/\s+/)[0] ?? user?.email?.split("@")[0];
    return firstName?.trim() || fallback || "there";
  }, [firstName, user]);

  const completeOnboarding = async () => {
    if (!user || saving) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ has_seen_onboarding: true })
      .eq("id", user.id);

    if (error) {
      setSaving(false);
      toast.error("We couldn't save your progress. Please try again.");
      return;
    }

    await refreshStatus();
    navigate("/browse", { replace: true });
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <div className="flex items-center justify-center gap-2 text-foreground">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
            <Store className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">Marketa</span>
        </div>

        <section className="flex flex-1 flex-col justify-center py-8 sm:py-12" aria-labelledby="welcome-heading">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex w-fit items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              Verified and ready
            </div>
            <h1 id="welcome-heading" className="text-3xl font-bold sm:text-4xl">
              Welcome, {greetingName}! 🎉
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Buy unique items from trusted sellers or start selling your own — here’s how it works.
            </p>
          </div>

          <ol className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative rounded-lg border border-border bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 place-items-center rounded-md bg-primary-soft text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-border text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                  </div>
                  <h2 className="mt-5 text-lg font-semibold">{step.title}</h2>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </li>
              );
            })}
          </ol>

          <div className="mx-auto mt-8 flex w-full max-w-sm flex-col items-center gap-2">
            <Button size="lg" className="w-full gap-2" onClick={completeOnboarding} disabled={saving}>
              {saving ? "Getting things ready…" : "Explore the Marketplace"}
              {!saving && <ArrowRight className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" onClick={completeOnboarding} disabled={saving}>
              I’ll explore on my own
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Welcome;
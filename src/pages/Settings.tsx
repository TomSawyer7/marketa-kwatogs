import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMarketa } from "@/store/marketa";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Camera, ArrowLeft, LogOut } from "lucide-react";

const profileSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
  location: z.string().trim().min(2, "Location is required").max(80),
  bio: z.string().trim().max(280, "Keep your bio under 280 characters"),
});


const Settings = () => {
  const navigate = useNavigate();
  const { profile, updateProfile } = useMarketa();
  const { user, signOut, isVerified } = useAuth();
  const [form, setForm] = useState(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Keep form in sync with profile (e.g., when Supabase profile loads after auth)
  useEffect(() => { setForm(profile); }, [profile]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const onLogout = async () => {
    await signOut();
    toast.success("Logged out");
    navigate("/");
  };

  const onAvatar = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast.error("Please pick an image file.");
    if (f.size > 2 * 1024 * 1024) return toast.error("Image too large (max 2MB).");
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = profileSchema.safeParse({
      email: form.email, location: form.location, bio: form.bio,
    });

    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path[0] as string;
        if (!fe[k]) fe[k] = iss.message;
      });
      setErrors(fe);
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile(form);
      toast.success("Settings saved");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="px-4 md:px-6 lg:px-8 py-5 md:py-6 max-w-3xl">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-3 gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Account settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, notifications, and privacy.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          {/* Profile */}
          <section className="bg-card border border-border rounded-lg p-5 md:p-6">
            <h3 className="font-semibold text-lg">Profile</h3>
            <p className="text-sm text-muted-foreground">This is how other people see you on Marketa.</p>

            <div className="mt-4 flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={form.avatar} alt={form.name} />
                <AvatarFallback>{form.name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-secondary cursor-pointer text-sm">
                <Camera className="h-4 w-4" /> Change photo
                <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={form.name} readOnly disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">
                  {isVerified
                    ? "Locked to your verified ID name. Contact support if this is incorrect."
                    : "Your display name will be set automatically once your ID is verified."}
                </p>
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" maxLength={120} value={form.email} onChange={(e) => set("email", e.target.value)} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" maxLength={80} value={form.location} onChange={(e) => set("location", e.target.value)} />
                {errors.location && <p className="text-xs text-destructive mt-1">{errors.location}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" rows={3} maxLength={280} value={form.bio} onChange={(e) => set("bio", e.target.value)} />
                <div className="flex justify-between mt-1">
                  {errors.bio
                    ? <p className="text-xs text-destructive">{errors.bio}</p>
                    : <span className="text-xs text-muted-foreground">Tell buyers a little about yourself.</span>}
                  <span className="text-xs text-muted-foreground">{form.bio.length}/280</span>
                </div>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className="bg-card border border-border rounded-lg p-5 md:p-6">
            <h3 className="font-semibold text-lg">Notifications</h3>
            <p className="text-sm text-muted-foreground">Choose what you'd like to hear about.</p>
            <div className="mt-4 divide-y divide-border">
              {[
                { key: "messages", label: "New messages", hint: "Get notified when buyers message you." },
                { key: "deals", label: "Price drops & deals", hint: "Updates on saved listings and recommendations." },
                { key: "newsletter", label: "Marketa newsletter", hint: "Occasional product news and tips." },
              ].map((n) => (
                <div key={n.key} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-sm">{n.label}</div>
                    <div className="text-xs text-muted-foreground">{n.hint}</div>
                  </div>
                  <Switch
                    checked={form.notifications[n.key as keyof typeof form.notifications]}
                    onCheckedChange={(v) =>
                      set("notifications", { ...form.notifications, [n.key]: v })
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Privacy */}
          <section className="bg-card border border-border rounded-lg p-5 md:p-6">
            <h3 className="font-semibold text-lg">Privacy</h3>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Profile visibility</Label>
                <Select value={form.visibility} onValueChange={(v) => set("visibility", v as typeof form.visibility)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — anyone can see</SelectItem>
                    <SelectItem value="private">Private — only buyers I message</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setForm(profile)} disabled={saving}>Reset</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
          </div>
        </form>

        {user && (
          <section className="mt-6 bg-card border border-border rounded-lg p-5 md:p-6 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Session</h3>
              <p className="text-sm text-muted-foreground">Signed in as {user.email}.</p>
            </div>
            <Button variant="outline" onClick={onLogout} className="gap-2">
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </section>
        )}

        {user && (
          <section className="mt-6 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">Account management</h3>
              <p className="text-sm text-muted-foreground">
                Take a break or leave for good — these are two different things.
              </p>
            </div>

            {/* Deactivate — temporary */}
            <div className="bg-card border border-yellow-500/40 rounded-lg p-5 md:p-6">
              <div className="flex items-start gap-3">
                <PauseCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold">Deactivate account (temporary)</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Hides your profile and listings from the marketplace. Nothing is deleted — your
                    messages, transactions and data stay exactly as they are. Choose 7, 30 or 90
                    days and it reactivates automatically, or stay hidden indefinitely and come back
                    whenever you want.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires your MPIN and password.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                {isDeactivated ? (
                  <Button onClick={onReactivate}>Reactivate now</Button>
                ) : (
                  <Button variant="outline" onClick={() => setDeactivateOpen(true)}>
                    Deactivate account
                  </Button>
                )}
              </div>
            </div>

            {/* Delete — permanent */}
            <div className="bg-card border border-destructive/40 rounded-lg p-5 md:p-6">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-destructive">
                    Delete account permanently (right to be forgotten)
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Starts a 30-day grace period during which your account is hidden and you can
                    still cancel. After that your name, email and all KYC/ID and liveness data are
                    permanently erased and replaced with a “Deleted User” placeholder. Transaction
                    and listing history is kept, anonymized, for accounting and legal reasons.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Requires your MPIN, password and an 8-digit code emailed to you.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                {isPendingDeletion ? (
                  <Button variant="outline" onClick={onCancelDeletion}>
                    Cancel deletion request
                  </Button>
                ) : (
                  <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                    Delete account
                  </Button>
                )}
              </div>
            </div>
          </section>
        )}

        <DeactivateAccountDialog open={deactivateOpen} onOpenChange={setDeactivateOpen} />
        <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
      </div>
    </AppShell>
  );
};

export default Settings;

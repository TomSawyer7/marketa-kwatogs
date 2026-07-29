import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Store } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useMpin } from "@/hooks/use-mpin";
import { MpinInput, MPIN_LENGTH } from "@/components/mpin/MpinInput";

const MpinSetup = () => {
  const navigate = useNavigate();
  const { loading, status, setMpin } = useMpin();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = "Set up your MPIN · Marketa";
  }, []);

  useEffect(() => {
    if (!loading && status?.has_mpin) navigate("/browse", { replace: true });
  }, [loading, status, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) {
      toast.error("Your MPIN must be 6 digits.");
      return;
    }
    if (pin !== confirm) {
      toast.error("The two MPINs don't match.");
      return;
    }
    setBusy(true);
    const { error } = await setMpin(pin);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("MPIN created.");
    navigate("/browse", { replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary/40 grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-6">
          <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center">
            <Store className="h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">Marketa</span>
        </Link>

        <div className="bg-card border border-border rounded-xl shadow-sm p-6 md:p-8">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-center mt-4">
            Set up your MPIN
          </h1>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Your identity is verified. Create a 6-digit MPIN — you'll be asked for it when
            opening your Inbox, Add Listing, and Settings.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">Enter MPIN</p>
              <MpinInput value={pin} onChange={setPin} autoFocus disabled={busy} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground">Confirm MPIN</p>
              <MpinInput value={confirm} onChange={setConfirm} disabled={busy} />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || pin.length !== MPIN_LENGTH || confirm.length !== MPIN_LENGTH}
            >
              {busy ? "Saving…" : "Create MPIN"}
            </Button>
          </form>

          <p className="mt-5 text-xs text-center text-muted-foreground">
            Forgot it later? You'll need your account password to reset it.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MpinSetup;

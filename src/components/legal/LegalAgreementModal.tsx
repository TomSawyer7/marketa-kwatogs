import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { LegalDoc } from "@/content/legal/types";
import { LEGAL_LAST_UPDATED } from "@/lib/legal-version";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doc: LegalDoc;
  version: string;
  onAgree: () => void;
};

export function LegalAgreementModal({ open, onOpenChange, doc, version, onAgree }: Props) {
  const [understood, setUnderstood] = useState(false);

  useEffect(() => {
    if (open) setUnderstood(false);
  }, [open]);

  const handleAgree = () => {
    if (!understood) return;
    onAgree();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
          <DialogTitle className="text-xl">{doc.title}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Last updated {LEGAL_LAST_UPDATED} · Version {version}
          </DialogDescription>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="prose prose-neutral dark:prose-invert max-w-none text-[14px] leading-relaxed">
            <div className="mb-5 text-muted-foreground">{doc.intro}</div>
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="mb-6">
                <h2 className="text-base font-semibold tracking-tight mt-0 mb-2 text-foreground">
                  {s.title}
                </h2>
                <div className="text-muted-foreground">{s.body}</div>
              </section>
            ))}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-10 bg-background border-t border-border px-6 py-4 space-y-3">
          <label className="flex items-start gap-2 text-sm text-foreground cursor-pointer">
            <Checkbox
              checked={understood}
              onCheckedChange={(v) => setUnderstood(v === true)}
              className="mt-0.5"
            />
            <span>I have read and understood this document.</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleAgree} disabled={!understood}>
              Agree
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

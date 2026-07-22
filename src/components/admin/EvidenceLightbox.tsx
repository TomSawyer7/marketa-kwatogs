import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSignedUrl } from "@/hooks/use-signed-url";

function LightboxImg({ path }: { path: string }) {
  const url = useSignedUrl("appeal-evidence", path);
  if (!url) return <div className="h-[70vh] w-full bg-muted animate-pulse rounded" />;
  return <img src={url} alt="evidence" className="max-h-[80vh] mx-auto rounded" />;
}

export function EvidenceLightbox({
  paths, index, onIndexChange, open, onOpenChange,
}: {
  paths: string[];
  index: number;
  onIndexChange: (i: number) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onIndexChange(Math.min(paths.length - 1, index + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, paths.length, onIndexChange]);

  const path = paths[index];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <div className="relative">
          {path && <LightboxImg path={path} />}
          {paths.length > 1 && (
            <>
              <Button size="icon" variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={() => onIndexChange(Math.max(0, index - 1))} disabled={index === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="secondary" className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => onIndexChange(Math.min(paths.length - 1, index + 1))} disabled={index === paths.length - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="text-center text-xs text-muted-foreground mt-2">
                {index + 1} / {paths.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

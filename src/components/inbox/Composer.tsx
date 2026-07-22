import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onSendText: (body: string) => Promise<void>;
  onSendImage: (file: File, caption?: string) => Promise<void>;
  onTyping?: () => void;
};

export function Composer({ onSendText, onSendImage, onTyping }: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please choose an image."); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB."); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPending(f);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const clearPending = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPending(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && !pending) return;
    setBusy(true);
    try {
      if (pending) {
        await onSendImage(pending, body || undefined);
        clearPending();
      } else {
        await onSendText(body);
      }
      setText("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-border bg-card px-3 md:px-4 py-3 space-y-2">
      {previewUrl && (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt="Attachment preview"
            className="h-24 w-24 rounded-lg object-cover border border-border"
          />
          <button
            type="button"
            onClick={clearPending}
            aria-label="Remove attachment"
            className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 shadow"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="rounded-full h-11 w-11 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Attach image"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => { setText(e.target.value); onTyping?.(); }}
          placeholder={pending ? "Add a caption…" : "Type a message…"}
          className="rounded-full h-11 bg-muted border-transparent focus-visible:bg-card"
          autoComplete="off"
          disabled={busy}
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full h-11 w-11 shrink-0"
          disabled={busy || (!text.trim() && !pending)}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

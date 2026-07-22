import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, Send, X, CornerUpLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "@/lib/inbox";

type Props = {
  onSendText: (body: string, replyToId?: string | null) => Promise<void>;
  onSendImage: (file: File, caption?: string, replyToId?: string | null) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onTyping?: () => void;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  editing?: Message | null;
  onCancelEdit?: () => void;
  otherName?: string;
  meId?: string;
};

export function Composer({
  onSendText, onSendImage, onEdit, onTyping,
  replyTo, onCancelReply, editing, onCancelEdit, otherName, meId,
}: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) setText(editing.body ?? "");
  }, [editing?.id]);

  const pickFile = (f: File | null | undefined) => {
    if (!f) return;
    if (editing) { toast.error("Finish editing first."); return; }
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

  const cancelEdit = () => {
    setText("");
    onCancelEdit?.();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body && !pending) return;
    setBusy(true);
    try {
      if (editing) {
        await onEdit(editing.id, body);
        setText("");
        onCancelEdit?.();
      } else if (pending) {
        await onSendImage(pending, body || undefined, replyTo?.id ?? null);
        clearPending();
        onCancelReply?.();
        setText("");
      } else {
        await onSendText(body, replyTo?.id ?? null);
        onCancelReply?.();
        setText("");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const replyLabel = replyTo
    ? replyTo.sender_id === meId ? "yourself" : (otherName ?? "message")
    : null;
  const replySnippet = replyTo?.is_unsent
    ? "Message unsent"
    : replyTo?.body?.trim() || (replyTo?.image_url ? "📷 Photo" : "");

  return (
    <form onSubmit={submit} className="border-t border-border bg-card px-3 md:px-4 py-3 space-y-2">
      {editing && (
        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate">Editing message…</span>
          <button type="button" onClick={cancelEdit} aria-label="Cancel edit" className="p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {!editing && replyTo && (
        <div className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
          <CornerUpLeft className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium">Replying to {replyLabel}</div>
            <div className="truncate text-muted-foreground">{replySnippet}</div>
          </div>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" className="p-0.5">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {previewUrl && (
        <div className="relative inline-block">
          <img src={previewUrl} alt="Attachment preview" className="h-24 w-24 rounded-lg object-cover border border-border" />
          <button type="button" onClick={clearPending} aria-label="Remove attachment"
            className="absolute -top-1.5 -right-1.5 rounded-full bg-background border border-border p-0.5 shadow">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])} />
        <Button type="button" size="icon" variant="ghost"
          className="rounded-full h-11 w-11 shrink-0"
          onClick={() => fileRef.current?.click()}
          disabled={busy || !!editing}
          aria-label="Attach image">
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          value={text}
          onChange={(e) => { setText(e.target.value); onTyping?.(); }}
          placeholder={editing ? "Edit your message…" : pending ? "Add a caption…" : "Type a message…"}
          className="rounded-full h-11 bg-muted border-transparent focus-visible:bg-card"
          autoComplete="off"
          disabled={busy}
        />
        <Button type="submit" size="icon" className="rounded-full h-11 w-11 shrink-0"
          disabled={busy || (!text.trim() && !pending)}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

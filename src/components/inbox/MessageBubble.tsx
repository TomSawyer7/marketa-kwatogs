import { useState } from "react";
import { formatRelative } from "@/lib/format";
import { Check, CheckCheck, CheckCircle2, ShieldAlert, MoreHorizontal, CornerUpLeft, Pencil, Trash2, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSignedUrl } from "@/hooks/use-signed-url";
import type { Message } from "@/lib/inbox";
import type { TxRow } from "@/hooks/use-thread-transaction";

type Props = {
  m: Message;
  mine: boolean;
  tx?: TxRow | null;
  viewerRole?: "buyer" | "seller" | null;
  onConfirmed?: () => void;
  quoted?: Message | null;
  otherName?: string;
  onReply?: (m: Message) => void;
  onEdit?: (m: Message) => void;
  onUnsend?: (m: Message) => Promise<void>;
  onRemoveImage?: (m: Message) => Promise<void>;
  onJumpTo?: (id: string) => void;
};

export function MessageBubble({
  m, mine, tx, viewerRole, onConfirmed,
  quoted, otherName, onReply, onEdit, onUnsend, onRemoveImage, onJumpTo,
}: Props) {
  const [busy, setBusy] = useState<"confirm" | "dispute" | null>(null);
  const [unsendOpen, setUnsendOpen] = useState(false);
  const [removeImgOpen, setRemoveImgOpen] = useState(false);

  if (m.kind === "system") {
    const event = (m.meta as { event?: string; transaction_id?: string } | undefined)?.event;
    const metaTxId = (m.meta as { transaction_id?: string } | undefined)?.transaction_id;
    const isCurrentTx = tx && metaTxId === tx.id;

    if (event === "seller_completed" && viewerRole === "buyer" && isCurrentTx && tx?.status === "seller_completed") {
      const act = async (kind: "confirm" | "dispute") => {
        if (!tx) return;
        setBusy(kind);
        const { error } = await supabase
          .from("transactions")
          .update({ status: kind === "confirm" ? "completed" : "discussion" })
          .eq("id", tx.id);
        setBusy(null);
        if (error) { toast.error(error.message); return; }
        if (kind === "confirm") { toast.success("Transaction confirmed."); onConfirmed?.(); }
        else toast("Marked as not yet complete.");
      };
      return (
        <div className="my-3 flex justify-center">
          <div className="w-full max-w-md rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-center shadow-sm">
            <div className="text-sm font-medium text-foreground">
              The seller has marked this transaction as completed.
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Did you receive your item/service?
            </div>
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" className="rounded-full gap-1.5" disabled={!!busy} onClick={() => act("confirm")}>
                <CheckCircle2 className="h-4 w-4" />
                {busy === "confirm" ? "Confirming…" : "Confirm & Rate"}
              </Button>
              <Button size="sm" variant="outline" className="rounded-full gap-1.5" disabled={!!busy} onClick={() => act("dispute")}>
                <ShieldAlert className="h-4 w-4" />
                {busy === "dispute" ? "…" : "Dispute / Not Yet"}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (event === "seller_completed" && viewerRole === "seller") {
      return (
        <div className="my-3 flex justify-center">
          <div className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-center max-w-md">
            You marked this transaction as done. Waiting for the buyer to confirm.
          </div>
        </div>
      );
    }

    return (
      <div className="my-3 flex justify-center">
        <div className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-center max-w-md">
          {m.body}
        </div>
      </div>
    );
  }

  const unsent = m.is_unsent;
  const canEdit = mine && !unsent && !m.image_url && (m.body?.trim().length ?? 0) > 0;
  const canRemoveImage = mine && !unsent && !!m.image_url;

  const doUnsend = async () => {
    try { await onUnsend?.(m); } catch (e) { toast.error((e as Error).message); }
    setUnsendOpen(false);
  };
  const doRemoveImg = async () => {
    try { await onRemoveImage?.(m); } catch (e) { toast.error((e as Error).message); }
    setRemoveImgOpen(false);
  };

  return (
    <div className={cn("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
      {mine && !unsent && (
        <MessageActions
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onReply={() => onReply?.(m)}
          canEdit={canEdit}
          onEdit={() => onEdit?.(m)}
          canRemoveImage={canRemoveImage}
          onRemoveImage={() => setRemoveImgOpen(true)}
          onUnsend={() => setUnsendOpen(true)}
        />
      )}
      <div className="max-w-[75%]">
        {quoted && (
          <button
            type="button"
            onClick={() => onJumpTo?.(quoted.id)}
            className={cn(
              "mb-1 w-full text-left rounded-lg border-l-2 border-primary/60 bg-muted/60 px-2.5 py-1.5 text-[11px]",
              mine ? "ml-auto" : "",
            )}
          >
            <div className="font-medium text-muted-foreground truncate">
              {quoted.sender_id === m.sender_id ? "You" : otherName ?? "Reply"}
            </div>
            <div className="truncate text-muted-foreground">
              {quoted.is_unsent ? "Message unsent" : quoted.body?.trim() || (quoted.image_url ? "📷 Photo" : "")}
            </div>
          </button>
        )}
        {unsent ? (
          <div className={cn(
            "px-3.5 py-2 rounded-2xl text-sm italic border border-dashed",
            mine
              ? "border-primary/30 text-primary-foreground/70 bg-primary/40 rounded-br-sm"
              : "border-border text-muted-foreground bg-muted/60 rounded-bl-sm",
          )}>
            Message unsent
          </div>
        ) : m.image_url ? (
          <ImageBubble path={m.image_url} caption={m.body ?? ""} mine={mine} />
        ) : (
          <div
            className={cn(
              "px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
              mine
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm",
            )}
          >
            {m.body}
          </div>
        )}
        <div className={cn("mt-1 flex items-center gap-1 text-[10px] text-muted-foreground", mine ? "justify-end" : "justify-start")}>
          <span>{formatRelative(new Date(m.created_at).getTime())}</span>
          {m.is_edited && !unsent && <span>· edited</span>}
          {mine && !unsent && (m.read_at ? <CheckCheck className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3" />)}
        </div>
      </div>
      {!mine && !unsent && (
        <MessageActions
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          onReply={() => onReply?.(m)}
        />
      )}

      <AlertDialog open={unsendOpen} onOpenChange={setUnsendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsend this message?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed for everyone in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doUnsend}>Unsend</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeImgOpen} onOpenChange={setRemoveImgOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove image?</AlertDialogTitle>
            <AlertDialogDescription>
              The photo will be deleted. Any caption stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRemoveImg}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MessageActions({
  className, onReply, canEdit, onEdit, canRemoveImage, onRemoveImage, onUnsend,
}: {
  className?: string;
  onReply?: () => void;
  canEdit?: boolean;
  onEdit?: () => void;
  canRemoveImage?: boolean;
  onRemoveImage?: () => void;
  onUnsend?: () => void;
}) {
  const showMenu = onEdit || onRemoveImage || onUnsend;
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={onReply} aria-label="Reply">
        <CornerUpLeft className="h-3.5 w-3.5" />
      </Button>
      {showMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-full" aria-label="More actions">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            {canRemoveImage && (
              <DropdownMenuItem onClick={onRemoveImage}>
                <ImageOff className="h-3.5 w-3.5 mr-2" /> Remove image
              </DropdownMenuItem>
            )}
            {(canEdit || canRemoveImage) && onUnsend && <DropdownMenuSeparator />}
            {onUnsend && (
              <DropdownMenuItem onClick={onUnsend} className="text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Unsend
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function ImageBubble({ path, caption, mine }: { path: string; caption: string; mine: boolean }) {
  const url = useSignedUrl("chat-attachments", path);
  return (
    <div className={cn("overflow-hidden rounded-2xl", mine ? "rounded-br-sm" : "rounded-bl-sm")}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={caption || "attachment"} className="max-h-72 w-auto object-cover" />
        </a>
      ) : (
        <div className="h-40 w-56 bg-muted animate-pulse" />
      )}
      {caption?.trim() && (
        <div
          className={cn(
            "px-3.5 py-2 text-sm whitespace-pre-wrap break-words",
            mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

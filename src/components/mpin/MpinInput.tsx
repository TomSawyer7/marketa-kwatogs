import * as React from "react";
import { OTPInputContext } from "input-otp";
import { Eye, EyeOff } from "lucide-react";
import { InputOTP, InputOTPGroup } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";

export const MPIN_LENGTH = 6;

function MpinSlot({ index, masked }: { index: number; masked: boolean }) {
  const ctx = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = ctx.slots[index];

  return (
    <div
      className={cn(
        "relative flex h-12 w-11 items-center justify-center border-y border-r border-input text-lg transition-all first:rounded-l-md first:border-l last:rounded-r-md",
        isActive && "z-10 ring-2 ring-ring ring-offset-background",
      )}
    >
      {char ? (masked ? <span className="text-xl leading-none">●</span> : char) : null}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink h-4 w-px bg-foreground duration-1000" />
        </div>
      )}
    </div>
  );
}

export function MpinInput({
  value,
  onChange,
  autoFocus,
  disabled,
  onComplete,
  allowReveal = true,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (v: string) => void;
  allowReveal?: boolean;
}) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <InputOTP
        maxLength={MPIN_LENGTH}
        value={value}
        onChange={onChange}
        onComplete={onComplete}
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
      >
        <InputOTPGroup>
          {Array.from({ length: MPIN_LENGTH }).map((_, i) => (
            <MpinSlot key={i} index={i} masked={!revealed} />
          ))}
        </InputOTPGroup>
      </InputOTP>

      {allowReveal && (
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {revealed ? "Hide MPIN" : "Show MPIN"}
        </button>
      )}
    </div>
  );
}

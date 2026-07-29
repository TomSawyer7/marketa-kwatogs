import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const MPIN_LENGTH = 6;

export function MpinInput({
  value,
  onChange,
  autoFocus,
  disabled,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  onComplete?: (v: string) => void;
}) {
  return (
    <div className="flex justify-center">
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
            <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

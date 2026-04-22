import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Props = {
  password: string;
  className?: string;
};

const checks = [
  { id: "length", test: (v: string) => v.length >= 8 },
  { id: "upper", test: (v: string) => /[A-Z]/.test(v) },
  { id: "lower", test: (v: string) => /[a-z]/.test(v) },
  { id: "number", test: (v: string) => /\d/.test(v) },
  { id: "special", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

const levels = [
  { label: "Too weak", barClass: "bg-destructive", textClass: "text-destructive" },
  { label: "Weak", barClass: "bg-destructive", textClass: "text-destructive" },
  { label: "Fair", barClass: "bg-orange-500", textClass: "text-orange-500" },
  { label: "Good", barClass: "bg-yellow-500", textClass: "text-yellow-600 dark:text-yellow-500" },
  { label: "Strong", barClass: "bg-primary", textClass: "text-primary" },
  { label: "Very strong", barClass: "bg-primary", textClass: "text-primary" },
];

export function getPasswordScore(password: string) {
  if (!password) return 0;
  return checks.reduce((acc, c) => acc + (c.test(password) ? 1 : 0), 0);
}

const PasswordStrengthMeter = ({ password, className }: Props) => {
  const score = useMemo(() => getPasswordScore(password), [password]);
  const level = levels[score] ?? levels[0];
  const segments = 5;
  const filled = Math.min(score, segments);

  if (!password) return null;

  return (
    <div className={cn("mt-2 space-y-1", className)} aria-live="polite">
      <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={segments} aria-valuenow={filled}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < filled ? level.barClass : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", level.textClass)}>
        Password strength: {level.label}
      </p>
    </div>
  );
};

export default PasswordStrengthMeter;

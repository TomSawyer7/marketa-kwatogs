export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export const formatRelative = (ts: number) => {
  const diff = Date.now() - ts;
  const minute = 60_000, hour = 60 * minute, day = 24 * hour, week = 7 * day;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  if (diff < week) return `${Math.round(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString();
};

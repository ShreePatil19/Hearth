import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  min: number | null,
  max: number | null,
  currency: string = "AUD"
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-AU", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  // Explicit null checks: a legitimate amount of 0 is falsy and must not fall
  // through to "Varies". See #100.
  if (min !== null && max !== null && min !== max) return `${fmt(min)} to ${fmt(max)}`;
  if (min !== null) return fmt(min);
  if (max !== null) return `Up to ${fmt(max)}`;
  return "Varies";
}

export function generateSlug(name: string, organisation?: string | null): string {
  const raw = organisation ? `${name}-${organisation}` : name;
  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

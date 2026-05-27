"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  APPLICATION_CYCLES,
  GEOS,
  INDUSTRIES,
  OPPORTUNITY_TYPES,
  STAGES,
} from "@/lib/constants";

type FacetOption = { value: string; label: string };

type Facet = {
  paramKey: string;
  label: string;
  options?: readonly FacetOption[];
  isBoolean?: boolean;
};

const FACETS: readonly Facet[] = [
  { paramKey: "type", label: "Type", options: OPPORTUNITY_TYPES },
  { paramKey: "stage", label: "Stage", options: STAGES },
  { paramKey: "industry", label: "Industry", options: INDUSTRIES },
  { paramKey: "geo", label: "Region", options: GEOS },
  { paramKey: "cycle", label: "Cycle", options: APPLICATION_CYCLES },
  { paramKey: "aussie", label: "Australia Only", isBoolean: true },
  { paramKey: "equity", label: "Non-dilutive Only", isBoolean: true },
  { paramKey: "impact", label: "Impact-Focused Only", isBoolean: true },
] as const;

function valueLabel(facet: Facet, value: string): string {
  if (facet.isBoolean) return facet.label;
  return facet.options?.find((o) => o.value === value)?.label ?? value;
}

export function ActiveFilterChips() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const chips: Array<{ facet: Facet; value: string }> = [];
  for (const facet of FACETS) {
    const raw = searchParams.get(facet.paramKey);
    if (!raw) continue;
    if (facet.isBoolean) {
      if (raw === "true") chips.push({ facet, value: "true" });
      continue;
    }
    for (const value of raw.split(",").filter(Boolean)) {
      chips.push({ facet, value });
    }
  }

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const removeChip = useCallback(
    (facet: Facet, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (facet.isBoolean) {
        params.delete(facet.paramKey);
      } else {
        const current = params.get(facet.paramKey)?.split(",").filter(Boolean) ?? [];
        const next = current.filter((v) => v !== value);
        if (next.length) {
          params.set(facet.paramKey, next.join(","));
        } else {
          params.delete(facet.paramKey);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  if (chips.length === 0) return null;

  return (
    <section
      aria-label="Active filters"
      className="mb-5 flex flex-wrap items-center gap-2"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Active filters
      </span>
      {chips.map(({ facet, value }) => {
        const label = valueLabel(facet, value);
        const display = facet.isBoolean ? facet.label : `${facet.label}: ${label}`;
        const aria = facet.isBoolean
          ? `Remove ${facet.label} filter`
          : `Remove ${facet.label}: ${label} filter`;
        return (
          <button
            key={`${facet.paramKey}:${value}`}
            type="button"
            onClick={() => removeChip(facet, value)}
            aria-label={aria}
            className="group inline-flex items-center gap-1.5 rounded-full border border-hearth-200 bg-hearth-50 px-3 py-1 text-xs font-medium text-hearth-700 transition-colors duration-200 hover:border-hearth-300 hover:bg-hearth-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hearth-500 focus-visible:ring-offset-2"
          >
            <span>{display}</span>
            <X
              className="h-3 w-3 text-hearth-600 transition-colors duration-200 group-hover:text-hearth-800"
              aria-hidden="true"
            />
          </button>
        );
      })}
      {chips.length > 1 && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-1 text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hearth-500 focus-visible:ring-offset-2"
        >
          Clear all
        </button>
      )}
    </section>
  );
}

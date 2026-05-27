"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Filter, X, MapPin, Sparkles, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { OPPORTUNITY_TYPES, STAGES, INDUSTRIES, GEOS, APPLICATION_CYCLES } from "@/lib/constants";

function FilterGroup({
  title,
  paramKey,
  options,
  activeValues,
  onToggle,
}: {
  title: string;
  paramKey: string;
  options: readonly { value: string; label: string }[];
  activeValues: string[];
  onToggle: (key: string, value: string, checked: boolean) => void;
}) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-2">
        {options.map((opt) => (
          <div key={opt.value} className="flex items-center space-x-2">
            <Checkbox
              id={`${paramKey}-${opt.value}`}
              checked={activeValues.includes(opt.value)}
              onCheckedChange={(checked) =>
                onToggle(paramKey, opt.value, !!checked)
              }
            />
            <Label
              htmlFor={`${paramKey}-${opt.value}`}
              className="text-sm font-normal cursor-pointer leading-none"
            >
              {opt.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterControls() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const getValues = useCallback(
    (key: string): string[] => {
      const val = searchParams.get(key);
      return val ? val.split(",").filter(Boolean) : [];
    },
    [searchParams]
  );

  const aussieOnly = searchParams.get("aussie") === "true";
  const equityFree = searchParams.get("equity") === "true";
  const impactFocus = searchParams.get("impact") === "true";

  const updateFilter = useCallback(
    (key: string, value: string, checked: boolean) => {
      const params = new URLSearchParams(searchParams.toString());
      const current = params.get(key)?.split(",").filter(Boolean) || [];

      if (checked) {
        current.push(value);
      } else {
        const idx = current.indexOf(value);
        if (idx > -1) current.splice(idx, 1);
      }

      if (current.length) {
        params.set(key, current.join(","));
      } else {
        params.delete(key);
      }

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const toggleAussie = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (aussieOnly) {
      params.delete("aussie");
    } else {
      params.set("aussie", "true");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname, aussieOnly]);

  const toggleEquity = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (equityFree) {
      params.delete("equity");
    } else {
      params.set("equity", "true");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname, equityFree]);

  const toggleImpact = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (impactFocus) {
      params.delete("impact");
    } else {
      params.set("impact", "true");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname, impactFocus]);

  const clearAll = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const hasFilters = searchParams.toString().length > 0;

  return (
    <div className="space-y-5">
      {/* Aussie Only toggle */}
      <button
        onClick={toggleAussie}
        className={`flex w-full items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-colors ${
          aussieOnly
            ? "border-hearth-200 bg-hearth-50 text-hearth-700"
            : "border-border bg-card hover:border-hearth-200 hover:bg-hearth-50/50"
        }`}
      >
        <MapPin className={`h-4 w-4 ${aussieOnly ? "text-hearth-500" : "text-muted-foreground"}`} />
        <span className="text-sm font-semibold">Australia Only</span>
      </button>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1.5 h-3 w-3" />
          Clear All
        </Button>
      )}

      <Separator />

      <FilterGroup
        title="Type"
        paramKey="type"
        options={OPPORTUNITY_TYPES}
        activeValues={getValues("type")}
        onToggle={updateFilter}
      />

      <Separator />

      <FilterGroup
        title="Stage"
        paramKey="stage"
        options={STAGES}
        activeValues={getValues("stage")}
        onToggle={updateFilter}
      />

      <Separator />

      <FilterGroup
        title="Industry"
        paramKey="industry"
        options={INDUSTRIES}
        activeValues={getValues("industry")}
        onToggle={updateFilter}
      />

      <Separator />

      <FilterGroup
        title="Region"
        paramKey="geo"
        options={GEOS}
        activeValues={getValues("geo")}
        onToggle={updateFilter}
      />

      <Separator />

      {/* Equity-free toggle */}
      <button
        onClick={toggleEquity}
        className={`flex w-full items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-colors ${
          equityFree
            ? "border-hearth-200 bg-hearth-50 text-hearth-700"
            : "border-border bg-card hover:border-hearth-200 hover:bg-hearth-50/50"
        }`}
      >
        <Banknote className={`h-4 w-4 ${equityFree ? "text-hearth-500" : "text-muted-foreground"}`} />
        <span className="text-sm font-semibold">Non-dilutive Only</span>
      </button>

      {/* Impact focus toggle */}
      <button
        onClick={toggleImpact}
        className={`flex w-full items-center gap-2.5 rounded-lg border-2 p-3 text-left transition-colors ${
          impactFocus
            ? "border-hearth-200 bg-hearth-50 text-hearth-700"
            : "border-border bg-card hover:border-hearth-200 hover:bg-hearth-50/50"
        }`}
      >
        <Sparkles className={`h-4 w-4 ${impactFocus ? "text-hearth-500" : "text-muted-foreground"}`} />
        <span className="text-sm font-semibold">Impact-Focused Only</span>
      </button>

      <Separator />

      <FilterGroup
        title="Application Cycle"
        paramKey="cycle"
        options={APPLICATION_CYCLES}
        activeValues={getValues("cycle")}
        onToggle={updateFilter}
      />
    </div>
  );
}

export function FilterSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 shrink-0">
        <div className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col rounded-xl border bg-card">
          <h2 className="flex shrink-0 items-center gap-2 border-b px-5 py-4 text-sm font-semibold">
            <Filter className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Filters
          </h2>
          <div className="overflow-y-auto px-5 py-5">
            <FilterControls />
          </div>
        </div>
      </aside>

      {/* Mobile sheet trigger */}
      <div className="md:hidden fixed bottom-4 right-4 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg bg-primary hover:bg-primary/90" aria-label="Open filters">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-xs overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FilterControls />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

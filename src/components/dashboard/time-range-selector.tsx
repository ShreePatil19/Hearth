"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const;

export function TimeRangeSelector() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const current = searchParams.get("range") || "30d";

  return (
    <div className="flex gap-1">
      {RANGES.map((range) => (
        <Button
          key={range.value}
          variant={current === range.value ? "default" : "ghost"}
          size="sm"
          className={current === range.value ? "bg-orange-500 hover:bg-orange-600" : ""}
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("range", range.value);
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          }}
        >
          {range.label}
        </Button>
      ))}
    </div>
  );
}

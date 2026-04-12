"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Clock, CalendarDays } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  grant: "bg-green-100 text-green-800 border-green-200",
  accelerator: "bg-blue-100 text-blue-800 border-blue-200",
  pitch_competition: "bg-purple-100 text-purple-800 border-purple-200",
  fund: "bg-amber-100 text-amber-800 border-amber-200",
  fellowship: "bg-pink-100 text-pink-800 border-pink-200",
  other: "bg-slate-100 text-slate-800 border-slate-200",
};

function formatDeadline(deadline: string | null): { text: string; urgent: boolean; icon: "clock" | "calendar" | null } {
  if (!deadline) return { text: "Rolling", urgent: false, icon: null };
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: "Closed", urgent: false, icon: null };
  if (diffDays === 0) return { text: "Today!", urgent: true, icon: "clock" };
  if (diffDays <= 7) return { text: `${diffDays}d left`, urgent: true, icon: "clock" };
  if (diffDays <= 30) return { text: `${diffDays}d left`, urgent: false, icon: "clock" };

  return {
    text: date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),
    urgent: false,
    icon: "calendar",
  };
}

export const columns: ColumnDef<Opportunity>[] = [
  {
    accessorKey: "name",
    header: "Opportunity",
    cell: ({ row }) => (
      <div className="max-w-[280px]">
        <Link
          href={`/opp/${row.original.slug}`}
          className="font-medium text-foreground hover:text-orange-600 transition-colors line-clamp-2"
        >
          {row.original.name}
        </Link>
        {row.original.organisation && (
          <p className="text-xs text-muted-foreground mt-0.5">{row.original.organisation}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.type;
      const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return (
        <Badge variant="outline" className={`${TYPE_COLORS[type] || TYPE_COLORS.other} text-xs font-medium`}>
          {label}
        </Badge>
      );
    },
  },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="text-sm font-medium whitespace-nowrap">
        {formatCurrency(row.original.amount_min, row.original.amount_max, row.original.currency)}
      </span>
    ),
    meta: { hideOnMobile: true },
  },
  {
    accessorKey: "deadline",
    header: "Deadline",
    cell: ({ row }) => {
      const { text, urgent, icon } = formatDeadline(row.original.deadline);
      return (
        <div className={`flex items-center gap-1.5 whitespace-nowrap ${urgent ? "text-red-600 font-semibold" : "text-sm text-muted-foreground"}`}>
          {icon === "clock" && <Clock className="h-3.5 w-3.5" />}
          {icon === "calendar" && <CalendarDays className="h-3.5 w-3.5" />}
          {text}
        </div>
      );
    },
  },
  {
    id: "geo",
    header: "Region",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.geo?.map((g: string) => (
          <Badge key={g} variant="outline" className="text-[10px] font-medium px-1.5 py-0">
            {g}
          </Badge>
        ))}
      </div>
    ),
    meta: { hideOnMobile: true },
  },
  {
    id: "source",
    header: "",
    cell: ({ row }) => (
      <a
        href={row.original.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground/50 hover:text-orange-500 transition-colors"
        title="View original source"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    ),
  },
];

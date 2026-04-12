"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Opportunity } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  grant: "bg-green-100 text-green-800",
  accelerator: "bg-blue-100 text-blue-800",
  pitch_competition: "bg-purple-100 text-purple-800",
  fund: "bg-amber-100 text-amber-800",
  fellowship: "bg-pink-100 text-pink-800",
  other: "bg-slate-100 text-slate-800",
};

function formatDeadline(deadline: string | null): { text: string; urgent: boolean } {
  if (!deadline) return { text: "Rolling", urgent: false };
  const date = new Date(deadline);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: "Closed", urgent: false };
  if (diffDays === 0) return { text: "Today", urgent: true };
  if (diffDays <= 7) return { text: `${diffDays}d left`, urgent: true };
  if (diffDays <= 30) return { text: `${diffDays}d left`, urgent: false };

  return {
    text: date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),
    urgent: false,
  };
}

export const columns: ColumnDef<Opportunity>[] = [
  {
    accessorKey: "name",
    header: "Opportunity",
    cell: ({ row }) => (
      <Link
        href={`/opp/${row.original.slug}`}
        className="font-medium hover:underline line-clamp-2"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.type;
      const label = type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return (
        <Badge variant="secondary" className={TYPE_COLORS[type] || TYPE_COLORS.other}>
          {label}
        </Badge>
      );
    },
  },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => (
      <span className="text-sm">
        {formatCurrency(row.original.amount_min, row.original.amount_max, row.original.currency)}
      </span>
    ),
    meta: { hideOnMobile: true },
  },
  {
    accessorKey: "deadline",
    header: "Deadline",
    cell: ({ row }) => {
      const { text, urgent } = formatDeadline(row.original.deadline);
      return (
        <span className={urgent ? "font-semibold text-red-600" : "text-sm"}>
          {text}
        </span>
      );
    },
  },
  {
    id: "geo",
    header: "Region",
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.geo?.map((g: string) => (
          <Badge key={g} variant="outline" className="text-xs">
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
        className="text-muted-foreground hover:text-foreground"
        title="View original source"
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    ),
  },
];

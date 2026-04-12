"use client";

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { columns } from "@/components/columns";
import { Inbox } from "lucide-react";
import type { Opportunity } from "@/lib/types";

interface OpportunityTableProps {
  data: Opportunity[];
}

export function OpportunityTable({ data }: OpportunityTableProps) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => {
                const hideOnMobile = (header.column.columnDef.meta as Record<string, boolean> | undefined)?.hideOnMobile;
                return (
                  <TableHead
                    key={header.id}
                    className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                      hideOnMobile ? "hidden md:table-cell" : ""
                    }`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="hover:bg-orange-50/50 transition-colors">
                {row.getVisibleCells().map((cell) => {
                  const hideOnMobile = (cell.column.columnDef.meta as Record<string, boolean> | undefined)?.hideOnMobile;
                  return (
                    <TableCell
                      key={cell.id}
                      className={hideOnMobile ? "hidden md:table-cell" : ""}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-40">
                <div className="flex flex-col items-center justify-center gap-2 text-center">
                  <Inbox className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No opportunities found
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    Try adjusting your filters or check back later
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

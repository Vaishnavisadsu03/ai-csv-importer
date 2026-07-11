"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/utils/cn";
import type { RawCsvRow } from "@/types";

interface Step2PreviewProps {
  fileName: string;
  totalRows: number;
  columns: string[];
  previewRows: RawCsvRow[];
  onBack: () => void;
  onConfirm: () => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function Step2Preview({
  fileName,
  totalRows,
  columns,
  previewRows,
  onBack,
  onConfirm,
}: Step2PreviewProps) {
  const [pageSize, setPageSize] = useState(10);

  // Build columns dynamically from the CSV headers
  const tableColumns = useMemo<ColumnDef<RawCsvRow>[]>(
    () =>
      columns.map((col) => ({
        id: col,
        accessorKey: col,
        header: col,
        cell: ({ getValue }) => {
          const val = getValue() as string;
          if (!val || val.trim() === "") {
            return <span className="text-muted-foreground/40 italic text-xs">—</span>;
          }
          return (
            <span className="block max-w-[200px] truncate text-sm" title={val}>
              {val}
            </span>
          );
        },
        size: 160,
      })),
    [columns]
  );

  const table = useReactTable({
    data: previewRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } },
  });

  const { pageIndex } = table.getState().pagination;
  const totalPages = table.getPageCount();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Preview parsed CSV</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review your data before sending it to AI for processing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Eye className="h-3 w-3 mr-1" />
            {previewRows.length} preview rows
          </Badge>
          <Badge variant="outline">{totalRows} total rows</Badge>
          <Badge variant="outline">{columns.length} columns</Badge>
        </div>
      </div>

      {/* File info */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {columns.length} columns detected · {totalRows} data rows
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-auto max-h-[420px]">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  <th className="w-10 border-b border-r px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                    #
                  </th>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border-b border-r last:border-r-0 px-3 py-2.5 text-left text-xs font-semibold text-foreground whitespace-nowrap"
                      style={{ minWidth: header.column.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                  )}
                >
                  <td className="border-b border-r px-3 py-2 text-center text-xs text-muted-foreground">
                    {pageIndex * pageSize + idx + 1}
                  </td>
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="border-b border-r last:border-r-0 px-3 py-2 align-top"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const size = Number(e.target.value);
                setPageSize(size);
                table.setPageSize(size);
              }}
              className="rounded border bg-background px-2 py-1 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>
              {pageIndex * pageSize + 1}–
              {Math.min((pageIndex + 1) * pageSize, previewRows.length)} of{" "}
              {previewRows.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="First page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs px-2">
              Page {pageIndex + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => table.setPageIndex(totalPages - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Last page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onConfirm} size="lg" className="min-w-[180px]">
          Looks good, Continue →
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  CheckCircle2,
  XCircle,
  SkipForward,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/utils/cn";
import { downloadJson, downloadCsv } from "@/utils/download";
import type { CrmRecord, SkippedRow, BatchError } from "@/types";

interface Step4ResultsProps {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  records: CrmRecord[];
  skippedRows: SkippedRow[];
  errors: BatchError[];
  processingTimeMs: number;
  onReset: () => void;
}

const CRM_COLUMNS: { key: keyof CrmRecord; label: string; width: number }[] = [
  { key: "name", label: "Name", width: 140 },
  { key: "email", label: "Email", width: 180 },
  { key: "country_code", label: "CC", width: 60 },
  { key: "mobile_without_country_code", label: "Mobile", width: 130 },
  { key: "company", label: "Company", width: 130 },
  { key: "city", label: "City", width: 100 },
  { key: "state", label: "State", width: 100 },
  { key: "country", label: "Country", width: 100 },
  { key: "crm_status", label: "Status", width: 160 },
  { key: "data_source", label: "Source", width: 130 },
  { key: "lead_owner", label: "Owner", width: 120 },
  { key: "crm_note", label: "Notes", width: 200 },
  { key: "created_at", label: "Created At", width: 150 },
  { key: "description", label: "Description", width: 200 },
  { key: "possession_time", label: "Possession", width: 120 },
];

const STATUS_COLORS: Record<string, string> = {
  GOOD_LEAD_FOLLOW_UP: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  DID_NOT_CONNECT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  BAD_LEAD: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  SALE_DONE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function Step4Results({
  importedCount,
  skippedCount,
  errorCount,
  records,
  skippedRows,
  errors,
  processingTimeMs,
  onReset,
}: Step4ResultsProps) {
  const [showSkipped, setShowSkipped] = useState(false);

  const tableColumns = useMemo<ColumnDef<CrmRecord>[]>(
    () =>
      CRM_COLUMNS.map(({ key, label, width }) => ({
        id: key,
        accessorKey: key,
        header: label,
        size: width,
        cell: ({ getValue }) => {
          const val = getValue() as string | null;
          if (!val) {
            return <span className="text-muted-foreground/40 text-xs italic">—</span>;
          }
          if (key === "crm_status") {
            return (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                  STATUS_COLORS[val] ?? "bg-muted text-muted-foreground"
                )}
              >
                {val.replace(/_/g, " ")}
              </span>
            );
          }
          return (
            <span
              className="block truncate text-xs"
              style={{ maxWidth: width - 16 }}
              title={val}
            >
              {val}
            </span>
          );
        },
      })),
    []
  );

  const table = useReactTable({
    data: records,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25, pageIndex: 0 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalPages = table.getPageCount();

  const timeStr =
    processingTimeMs < 1000
      ? `${processingTimeMs}ms`
      : `${(processingTimeMs / 1000).toFixed(1)}s`;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Import Results</h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Processed in {timeStr}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onReset}>
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          New Import
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-500/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
              <div>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {importedCount}
                </p>
                <p className="text-xs text-muted-foreground">Records imported</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <SkipForward className="h-8 w-8 text-yellow-500 shrink-0" />
              <div>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {skippedCount}
                </p>
                <p className="text-xs text-muted-foreground">Rows skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-500 shrink-0" />
              <div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {errorCount}
                </p>
                <p className="text-xs text-muted-foreground">Batch errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Download buttons */}
      {records.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => downloadJson(records)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadCsv(records)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>
        </div>
      )}

      {/* Records table */}
      {records.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    <th className="w-10 border-b border-r px-2 py-2.5 text-center text-xs font-medium text-muted-foreground">
                      #
                    </th>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-b border-r last:border-r-0 px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap"
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
                      "hover:bg-muted/40 transition-colors",
                      idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                    )}
                  >
                    <td className="border-b border-r px-2 py-2 text-center text-xs text-muted-foreground">
                      {pageIndex * pageSize + idx + 1}
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="border-b border-r last:border-r-0 px-3 py-2 align-middle"
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
          <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">
              {pageIndex * pageSize + 1}–
              {Math.min((pageIndex + 1) * pageSize, records.length)} of {records.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs px-2">
                {pageIndex + 1} / {totalPages}
              </span>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline" size="icon" className="h-7 w-7"
                onClick={() => table.setPageIndex(totalPages - 1)} disabled={!table.getCanNextPage()}
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Skipped rows */}
      {skippedRows.length > 0 && (
        <div>
          <Separator className="mb-4" />
          <button
            onClick={() => setShowSkipped((p) => !p)}
            className="flex items-center gap-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:underline"
          >
            <AlertTriangle className="h-4 w-4" />
            {skippedRows.length} skipped rows (no email or phone)
            <span className="text-muted-foreground">{showSkipped ? "▲" : "▼"}</span>
          </button>

          {showSkipped && (
            <div className="mt-3 space-y-2">
              {skippedRows.slice(0, 20).map((row) => (
                <Alert key={row.rowIndex} variant="warning">
                  <AlertTitle className="text-xs">
                    Row {row.rowIndex + 1} — {row.reason}
                  </AlertTitle>
                  <AlertDescription className="text-xs font-mono mt-1 truncate">
                    {JSON.stringify(row.originalData)}
                  </AlertDescription>
                </Alert>
              ))}
              {skippedRows.length > 20 && (
                <p className="text-xs text-muted-foreground">
                  …and {skippedRows.length - 20} more skipped rows
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch errors */}
      {errors.length > 0 && (
        <div>
          <Separator className="mb-4" />
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{errors.length} batch(es) failed after retries</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 space-y-1 text-xs">
                {errors.map((e) => (
                  <li key={e.batchIndex}>
                    Batch {e.batchIndex + 1} (rows {e.startRow + 1}–{e.endRow + 1}): {e.error}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}

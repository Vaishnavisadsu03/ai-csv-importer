"use client";

import { Brain, Rows3, Columns3, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface Step3ConfirmProps {
  fileName: string;
  totalRows: number;
  columns: string[];
  isLoading: boolean;
  processProgress: number;
  error: string | null;
  onBack: () => void;
  onProcess: () => void;
}

const CRM_FIELDS = [
  "name", "email", "country_code", "mobile", "company",
  "city", "state", "country", "crm_status", "data_source",
  "lead_owner", "crm_note", "description", "possession_time", "created_at",
];

export function Step3Confirm({
  fileName,
  totalRows,
  columns,
  isLoading,
  processProgress,
  error,
  onBack,
  onProcess,
}: Step3ConfirmProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Confirm &amp; Start AI Import</h2>
        <p className="text-sm text-muted-foreground mt-1">
          The AI will intelligently map your CSV columns to the CRM schema.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Rows3 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalRows}</p>
                <p className="text-xs text-muted-foreground">Total rows</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Columns3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{columns.length}</p>
                <p className="text-xs text-muted-foreground">Columns detected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{CRM_FIELDS.length}</p>
                <p className="text-xs text-muted-foreground">CRM fields</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI info */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Brain className="h-5 w-5 text-primary" />            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm">What the AI will do</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Understand your column names regardless of format or language</li>
                <li>• Map each column to the correct CRM field</li>
                <li>• Normalize phone numbers, dates, and country codes</li>
                <li>• Set CRM status and data source from available values</li>
                <li>• Aggregate extra data into notes</li>
                <li>• Skip rows with no email or phone</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Your columns */}
      <div>
        <p className="text-sm font-medium mb-2">Columns in your CSV</p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => (
            <Badge key={col} variant="outline" className="text-xs">
              {col}
            </Badge>
          ))}
        </div>
      </div>

      {/* File info */}
      <div className="text-xs text-muted-foreground">
        File: <span className="font-medium text-foreground">{fileName}</span>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Progress */}
      {isLoading && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">AI is processing your CSV…</span>
            <span className="ml-auto text-sm font-semibold text-primary">
              {Math.round(processProgress)}%
            </span>
          </div>
          <Progress value={processProgress} />
          <p className="text-xs text-muted-foreground">
            Mapping {totalRows} rows in batches of 25 · Please don't close this tab
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          ← Back
        </Button>
        <Button
          onClick={onProcess}
          disabled={isLoading}
          size="lg"
          className="min-w-[160px] bg-accent hover:bg-accent/90 text-white border-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Start AI Import
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

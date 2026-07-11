"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/utils/cn";

interface Step1UploadProps {
  onUpload: (file: File) => void;
  isLoading: boolean;
  uploadProgress: number;
  error: string | null;
}

const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export function Step1Upload({
  onUpload,
  isLoading,
  uploadProgress,
  error,
}: Step1UploadProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: { errors: { message: string }[] }[]) => {
      setLocalError(null);

      if (rejectedFiles.length > 0) {
        const err = rejectedFiles[0]?.errors[0];
        if (err?.message.includes("file-too-large")) {
          setLocalError(`File is too large. Maximum size is ${MAX_SIZE_MB}MB.`);
        } else if (err?.message.includes("file-invalid-type")) {
          setLocalError("Only CSV files are accepted.");
        } else {
          setLocalError(err?.message ?? "Invalid file.");
        }
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      // Extra validation: check extension
      if (!file.name.toLowerCase().endsWith(".csv")) {
        setLocalError("Only .csv files are accepted.");
        return;
      }

      setSelectedFile(file);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/csv": [".csv"],
      "text/plain": [".csv"],
    },
    maxSize: MAX_SIZE_BYTES,
    maxFiles: 1,
    disabled: isLoading,
  });

  const displayError = error ?? localError;

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setLocalError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Upload your CSV file</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Supports any CSV format — Facebook exports, Google Ads, CRM exports, Excel sheets, and more.
        </p>
      </div>

      {/* Dropzone */}
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200",
            "hover:border-primary/60 hover:bg-primary/5",
            isDragActive && !isDragReject && "border-primary bg-primary/10 scale-[1.01]",
            isDragReject && "border-destructive bg-destructive/5",
            isLoading && "pointer-events-none opacity-60",
            !isDragActive && "border-muted-foreground/25"
          )}
        >
          <input {...getInputProps()} aria-label="Upload CSV file" />

          <div
            className={cn(
              "mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
              isDragActive && !isDragReject ? "bg-primary/20" : "bg-muted"
            )}
          >
            <Upload
              className={cn(
                "h-8 w-8 transition-colors",
                isDragActive && !isDragReject ? "text-primary" : "text-muted-foreground"
              )}
            />
          </div>

          {isDragActive && !isDragReject ? (
            <p className="text-lg font-medium text-primary">Drop your CSV here</p>
          ) : isDragReject ? (
            <p className="text-lg font-medium text-destructive">Only CSV files are allowed</p>
          ) : (
            <>
              <p className="text-base font-medium">
                Drag &amp; drop your CSV file here
              </p>
              <p className="mt-1 text-sm text-muted-foreground">or</p>
              <Button variant="outline" size="sm" className="mt-3 pointer-events-none">
                Browse files
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                CSV files only · max {MAX_SIZE_MB}MB
              </p>
            </>
          )}
        </div>
      ) : (
        /* Selected file card */
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          {!isLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          {isLoading && <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />}
        </div>
      )}

      {/* Upload progress */}
      {isLoading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uploading &amp; parsing CSV…</span>
            <span className="font-medium">{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} />
        </div>
      )}

      {/* Error */}
      {displayError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Supported sources */}
      <div className="rounded-lg bg-muted/40 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Supported sources</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Facebook Lead Ads",
            "Google Ads",
            "HubSpot Export",
            "Salesforce Export",
            "Excel / Google Sheets",
            "Custom CRM Exports",
            "Marketing Reports",
          ].map((source) => (
            <span
              key={source}
              className="rounded-full bg-background border px-2.5 py-0.5 text-xs"
            >
              {source}
            </span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={!selectedFile || isLoading}
          size="lg"
          className="min-w-[140px] bg-accent hover:bg-accent/90 text-white border-0"
        >
          {isLoading ? "Uploading…" : "Upload & Preview →"}
        </Button>
      </div>
    </div>
  );
}

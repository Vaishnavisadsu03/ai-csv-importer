// ─── CRM Record ───────────────────────────────────────────────────────────────

export interface CrmRecord {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: string | null;
  crm_note: string | null;
  data_source: string | null;
  possession_time: string | null;
  description: string | null;
}

export type RawCsvRow = Record<string, string>;

// ─── Stepper ──────────────────────────────────────────────────────────────────

export type StepId = 1 | 2 | 3 | 4;

export interface Step {
  id: StepId;
  title: string;
  description: string;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface UploadResponse {
  success: boolean;
  message: string;
  data: {
    sessionId: string;
    fileName: string;
    totalRows: number;
    columns: string[];
    preview: RawCsvRow[];
  };
}

export interface SkippedRow {
  rowIndex: number;
  reason: string;
  originalData: RawCsvRow;
}

export interface BatchError {
  batchIndex: number;
  startRow: number;
  endRow: number;
  error: string;
  retryCount: number;
}

export interface ProcessResponse {
  success: boolean;
  message: string;
  data: {
    sessionId: string;
    importedCount: number;
    skippedCount: number;
    errorCount: number;
    records: CrmRecord[];
    skippedRows: SkippedRow[];
    errors: BatchError[];
    processingTimeMs: number;
  };
}

// ─── Importer State ───────────────────────────────────────────────────────────

export interface ImporterState {
  currentStep: StepId;
  // Step 1
  file: File | null;
  // Step 2
  sessionId: string | null;
  fileName: string | null;
  totalRows: number;
  columns: string[];
  previewRows: RawCsvRow[];
  // Step 4
  result: ProcessResponse["data"] | null;
  // Status
  isLoading: boolean;
  error: string | null;
}

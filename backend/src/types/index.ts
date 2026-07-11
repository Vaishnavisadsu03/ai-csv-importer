// ─── CRM Enums ────────────────────────────────────────────────────────────────

export enum CrmStatus {
  GOOD_LEAD_FOLLOW_UP = "GOOD_LEAD_FOLLOW_UP",
  DID_NOT_CONNECT = "DID_NOT_CONNECT",
  BAD_LEAD = "BAD_LEAD",
  SALE_DONE = "SALE_DONE",
}

export enum DataSource {
  LEADS_ON_DEMAND = "leads_on_demand",
  MERIDIAN_TOWER = "meridian_tower",
  EDEN_PARK = "eden_park",
  VARAH_SWAMY = "varah_swamy",
  SARJAPUR_PLOTS = "sarjapur_plots",
  OTHER = "Other",
}

// ─── Core CRM Record ──────────────────────────────────────────────────────────

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
  crm_status: CrmStatus | null;
  crm_note: string | null;
  data_source: DataSource | string | null;
  possession_time: string | null;
  description: string | null;
}

// ─── Raw CSV Row ──────────────────────────────────────────────────────────────

export type RawCsvRow = Record<string, string>;

// ─── Upload API ───────────────────────────────────────────────────────────────

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

// ─── Process API ─────────────────────────────────────────────────────────────

export interface ProcessRequest {
  sessionId: string;
  rows: RawCsvRow[];
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

// ─── Batch Processing ─────────────────────────────────────────────────────────

export interface BatchResult {
  records: CrmRecord[];
  skippedRows: SkippedRow[];
  errors: BatchError[];
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

// ─── AI Service ───────────────────────────────────────────────────────────────

export interface AiMappingRequest {
  rows: RawCsvRow[];
  columns: string[];
}

export interface AiMappingResponse {
  records: CrmRecord[];
  skippedRows: SkippedRow[];
}

// ─── SSE Events ───────────────────────────────────────────────────────────────

export type SseEventType =
  | "progress"
  | "batch_complete"
  | "batch_error"
  | "complete"
  | "error";

export interface SseEvent {
  type: SseEventType;
  payload: Record<string, unknown>;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface AppConfig {
  port: number;
  nodeEnv: string;
  openAi: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  batch: {
    size: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  upload: {
    maxFileSizeMb: number;
    uploadDir: string;
  };
  cors: {
    origin: string;
  };
}

import type { CrmRecord } from "@/types";

const CRM_FIELDS: (keyof CrmRecord)[] = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
  "data_source",
  "possession_time",
  "description",
];

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadJson(records: CrmRecord[], filename = "crm-import.json"): void {
  const json = JSON.stringify(records, null, 2);
  triggerDownload(json, filename, "application/json");
}

export function downloadCsv(records: CrmRecord[], filename = "crm-import.csv"): void {
  const escape = (val: string | null): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = CRM_FIELDS.join(",");
  const rows = records.map((record) =>
    CRM_FIELDS.map((field) => escape(record[field])).join(",")
  );

  const csv = [header, ...rows].join("\n");
  triggerDownload(csv, filename, "text/csv;charset=utf-8;");
}

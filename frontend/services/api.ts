import axios from "axios";
import type { UploadResponse, ProcessResponse } from "@/types";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 300_000, // 5 min — AI processing can take time
  headers: {
    Accept: "application/json",
  },
});

// Response interceptor — normalize error messages
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ??
      error.message ??
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

/**
 * Upload a CSV file to the backend.
 * Returns session ID + preview data.
 */
export async function uploadCsv(
  file: File,
  onUploadProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiClient.post<UploadResponse>("/api/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && onUploadProgress) {
        const percent = Math.round((event.loaded * 100) / event.total);
        onUploadProgress(percent);
      }
    },
  });

  return response.data;
}

/**
 * Trigger AI processing for a previously uploaded session.
 */
export async function processCsv(sessionId: string): Promise<ProcessResponse> {
  const response = await apiClient.post<ProcessResponse>("/api/process", {
    sessionId,
  });
  return response.data;
}

/**
 * Health check.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await apiClient.get("/api/health");
    return true;
  } catch {
    return false;
  }
}

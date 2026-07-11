"use client";

import { useState, useCallback } from "react";
import { uploadCsv, processCsv } from "@/services/api";
import type { ImporterState, StepId, ProcessResponse } from "@/types";

const INITIAL_STATE: ImporterState = {
  currentStep: 1,
  file: null,
  sessionId: null,
  fileName: null,
  totalRows: 0,
  columns: [],
  previewRows: [],
  result: null,
  isLoading: false,
  error: null,
};

export function useImporter() {
  const [state, setState] = useState<ImporterState>(INITIAL_STATE);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processProgress, setProcessProgress] = useState(0);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error, isLoading: false }));
  }, []);

  const goToStep = useCallback((step: StepId) => {
    setState((prev) => ({ ...prev, currentStep: step, error: null }));
  }, []);

  // ─── Step 1 → 2: Upload CSV ────────────────────────────────────────────────
  const handleUpload = useCallback(
    async (file: File) => {
      setState((prev) => ({
        ...prev,
        file,
        isLoading: true,
        error: null,
      }));
      setUploadProgress(0);

      try {
        const response = await uploadCsv(file, (pct) => {
          setUploadProgress(pct);
        });

        setState((prev) => ({
          ...prev,
          isLoading: false,
          currentStep: 2,
          sessionId: response.data.sessionId,
          fileName: response.data.fileName,
          totalRows: response.data.totalRows,
          columns: response.data.columns,
          previewRows: response.data.preview,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    },
    [setError]
  );

  // ─── Step 2 → 3: Confirm ──────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    goToStep(3);
  }, [goToStep]);

  // ─── Step 3 → 4: Process with AI ─────────────────────────────────────────
  const handleProcess = useCallback(async () => {
    if (!state.sessionId) {
      setError("No session found. Please upload the CSV again.");
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    setProcessProgress(0);

    // Simulate progress while AI works
    const progressInterval = setInterval(() => {
      setProcessProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 8;
      });
    }, 800);

    try {
      const response: ProcessResponse = await processCsv(state.sessionId);

      clearInterval(progressInterval);
      setProcessProgress(100);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        currentStep: 4,
        result: response.data,
      }));
    } catch (err) {
      clearInterval(progressInterval);
      setProcessProgress(0);
      setError(err instanceof Error ? err.message : "Processing failed");
    }
  }, [state.sessionId, setError]);

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setState(INITIAL_STATE);
    setUploadProgress(0);
    setProcessProgress(0);
  }, []);

  return {
    state,
    uploadProgress,
    processProgress,
    handleUpload,
    handleConfirm,
    handleProcess,
    handleReset,
    goToStep,
  };
}

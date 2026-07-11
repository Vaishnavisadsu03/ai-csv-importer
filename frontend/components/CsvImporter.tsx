"use client";

import { Stepper } from "@/components/stepper/Stepper";
import { Step1Upload } from "@/components/steps/Step1Upload";
import { Step2Preview } from "@/components/steps/Step2Preview";
import { Step3Confirm } from "@/components/steps/Step3Confirm";
import { Step4Results } from "@/components/steps/Step4Results";
import { Card, CardContent } from "@/components/ui/card";
import { useImporter } from "@/hooks/useImporter";

export function CsvImporter() {
  const {
    state,
    uploadProgress,
    processProgress,
    handleUpload,
    handleConfirm,
    handleProcess,
    handleReset,
    goToStep,
  } = useImporter();

  return (
    <div className="flex flex-col gap-8">
      {/* Stepper */}
      <div className="px-2">
        <Stepper currentStep={state.currentStep} />
      </div>

      {/* Step content */}
      <Card className="shadow-lg">
        <CardContent className="p-6 sm:p-8">
          {state.currentStep === 1 && (
            <Step1Upload
              onUpload={handleUpload}
              isLoading={state.isLoading}
              uploadProgress={uploadProgress}
              error={state.error}
            />
          )}

          {state.currentStep === 2 && (
            <Step2Preview
              fileName={state.fileName ?? ""}
              totalRows={state.totalRows}
              columns={state.columns}
              previewRows={state.previewRows}
              onBack={() => goToStep(1)}
              onConfirm={handleConfirm}
            />
          )}

          {state.currentStep === 3 && (
            <Step3Confirm
              fileName={state.fileName ?? ""}
              totalRows={state.totalRows}
              columns={state.columns}
              isLoading={state.isLoading}
              processProgress={processProgress}
              error={state.error}
              onBack={() => goToStep(2)}
              onProcess={handleProcess}
            />
          )}

          {state.currentStep === 4 && state.result && (
            <Step4Results
              importedCount={state.result.importedCount}
              skippedCount={state.result.skippedCount}
              errorCount={state.result.errorCount}
              records={state.result.records}
              skippedRows={state.result.skippedRows}
              errors={state.result.errors}
              processingTimeMs={state.result.processingTimeMs}
              onReset={handleReset}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

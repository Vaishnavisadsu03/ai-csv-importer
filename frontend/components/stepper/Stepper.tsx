import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import type { StepId } from "@/types";

interface StepDef {
  id: StepId;
  title: string;
  description: string;
}

const STEPS: StepDef[] = [
  { id: 1, title: "Upload",  description: "Choose your CSV" },
  { id: 2, title: "Preview", description: "Review data" },
  { id: 3, title: "Confirm", description: "Start AI import" },
  { id: 4, title: "Results", description: "View records" },
];

interface StepperProps {
  currentStep: StepId;
}

export function Stepper({ currentStep }: StepperProps) {
  return (
    <nav aria-label="Import progress" className="w-full">
      <ol className="flex items-center w-full">
        {STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isActive    = step.id === currentStep;
          const isLast      = index === STEPS.length - 1;

          return (
            <li key={step.id} className={cn("flex items-center", !isLast && "flex-1")}>
              {/* Circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all duration-300",
                    isCompleted && "border-primary bg-primary text-white",
                    isActive && "border-primary bg-white text-primary shadow-md ring-4 ring-primary/20 dark:bg-card",
                    !isCompleted && !isActive && "border-muted-foreground/30 bg-background text-muted-foreground"
                  )}
                  aria-current={isActive ? "step" : undefined}
                >
                  {isCompleted
                    ? <Check className="h-5 w-5" strokeWidth={2.5} />
                    : <span>{step.id}</span>
                  }
                </div>

                {/* Labels — hidden on mobile */}
                <div className="hidden sm:flex flex-col items-center text-center">
                  <span className={cn(
                    "text-xs font-semibold",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground leading-tight max-w-[80px]">
                    {step.description}
                  </span>
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div className={cn(
                  "flex-1 h-0.5 mx-3 transition-all duration-500",
                  isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                )} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

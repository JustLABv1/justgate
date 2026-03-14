"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

export interface StepDef {
  id: string;
  label: string;
}

interface StepListProps {
  steps: StepDef[];
  currentStep: number;
}

export function StepList({ steps, currentStep }: StepListProps) {
  return (
    <nav className="flex items-center">
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all duration-200 ${
                  done
                    ? "border-success/40 bg-success/15 text-success"
                    : active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              <span
                className={`text-[13px] font-medium transition-colors duration-200 ${
                  active ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-3 h-px w-8 shrink-0 transition-colors duration-300 ${
                  done ? "bg-success/40" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

interface AnimatedStepProps {
  stepKey: string | number;
  direction: number; // 1 = forward, -1 = backward
  children: ReactNode;
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir * 28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -28, opacity: 0 }),
};

export function AnimatedStep({ stepKey, direction, children }: AnimatedStepProps) {
  return (
    <div className="overflow-hidden">
      <AnimatePresence custom={direction} mode="wait">
        <motion.div
          key={stepKey}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

type AuthStatusMessageProps = {
  tone: "error" | "success";
  message: string;
  className?: string;
};

export function AuthStatusMessage({ tone, message, className }: AuthStatusMessageProps) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2.5 text-sm leading-6",
        isError
          ? "border-destructive/38 bg-destructive/10 text-destructive"
          : "border-success/34 bg-success/10 text-success",
        className
      )}
      role={isError ? "alert" : "status"}
    >
      <span className="flex items-start gap-2.5">
        <Icon className="mt-1 size-4 shrink-0" />
        <span>{message}</span>
      </span>
    </div>
  );
}

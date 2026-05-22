"use client";

import { useFormState } from "react-dom";
import type { ActionResult } from "@/lib/action-result";

type ServerAction = (
  prevState: ActionResult,
  formData: FormData
) => Promise<ActionResult>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p className="mt-1.5 text-xs text-destructive">{state.error}</p>
      )}
    </form>
  );
}

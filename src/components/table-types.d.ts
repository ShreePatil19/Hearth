// TanStack Table column meta augmentation.
// Centralised so the cast `columnDef.meta as Record<string, boolean>` is no
// longer needed in components/columns.tsx and components/opportunity-table.tsx.
// See https://tanstack.com/table/v8/docs/api/core/column-def#meta

import "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends object, TValue> {
    hideOnMobile?: boolean;
  }
}

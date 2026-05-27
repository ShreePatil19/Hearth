import { z } from "zod";

const uuidSchema = z.string().uuid();

export function parseFormString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string" || value.length === 0) return null;
  return value;
}

export function parseFormUUID(formData: FormData, key: string): string | null {
  const value = parseFormString(formData, key);
  if (!value) return null;
  return uuidSchema.safeParse(value).success ? value : null;
}

export function parseFormBoolean(formData: FormData, key: string): boolean {
  return formData.get(key) === "true";
}

export function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") obj[key] = value;
  });
  return obj;
}

export function firstZodError(error: z.ZodError, fallback = "Invalid input"): string {
  return error.issues[0]?.message ?? fallback;
}

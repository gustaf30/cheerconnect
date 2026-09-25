import { z } from "zod";

export const externalHttpUrlSchema = z
  .string()
  .trim()
  .url("URL inválida")
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "URL deve usar http ou https");

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const instantPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function hasValidCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export const dateStringSchema = z
  .string()
  .trim()
  .min(1, "Data é obrigatória")
  .refine((value) => {
    if (!hasValidCalendarDate(value)) return false;
    if (dateOnlyPattern.test(value)) return true;
    return instantPattern.test(value) && !Number.isNaN(Date.parse(value));
  }, "Data inválida")
  .transform((value) => new Date(value));

export function assertDateOrder(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined
): void {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("A data de término deve ser igual ou posterior à data de início");
  }
}

export function canonicalPairKey(firstId: string, secondId: string): string {
  return firstId < secondId
    ? `${firstId}:${secondId}`
    : `${secondId}:${firstId}`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

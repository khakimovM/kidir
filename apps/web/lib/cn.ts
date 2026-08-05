type ClassValue = string | false | null | undefined;

/** Joins class names, dropping the falsy ones produced by conditionals. */
export function cn(...values: ClassValue[]): string {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}

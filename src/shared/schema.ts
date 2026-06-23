// JSON schema validation helpers for IPC handlers
// In v0.1 we use simple type guards; full JSON Schema planned for v0.2+

export function isString(v: unknown): v is string {
  return typeof v === "string";
}

export function isStringOrNull(v: unknown): v is string | null {
  return typeof v === "string" || v === null;
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function isOptionalString(v: unknown): v is string | undefined {
  return v === undefined || typeof v === "string";
}

export function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

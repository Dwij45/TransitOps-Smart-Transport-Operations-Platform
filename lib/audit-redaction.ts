const secretKey = /password|token|secret|authorization|cookie/i;

export function redactSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSnapshot);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        secretKey.test(key) ? "[redacted]" : redactSnapshot(item),
      ]),
    );
  }
  return value;
}

export const auditPageSize = 20;

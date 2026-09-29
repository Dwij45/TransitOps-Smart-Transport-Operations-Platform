export const exportRowLimit = 1000;

export function csvCell(value: string): string {
  const safe = value.replace(/\r?\n/g, " ");
  if (/[",]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function toCsv(headers: string[], rows: string[][]): { body: string; rowCount: number } {
  const limited = rows.slice(0, exportRowLimit);
  const body = [headers, ...limited].map((row) => row.map(csvCell).join(",")).join("\n");
  return { body, rowCount: limited.length };
}

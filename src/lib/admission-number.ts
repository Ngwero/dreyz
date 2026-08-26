/** Parse sequential admission numbers like DRY001 / DRY12 → numeric value. */
export function parseAdmissionNumber(id: string | undefined | null): number {
  if (!id) return 0;
  const m = String(id).trim().match(/^DRY0*(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

/** Format as DRY001, DRY012, DRY100, … */
export function formatAdmissionNumber(n: number): string {
  const safe = Math.max(1, Math.floor(n));
  return `DRY${String(safe).padStart(3, "0")}`;
}

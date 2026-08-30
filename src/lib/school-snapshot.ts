/** Shared snapshot merge — safe to import from client and server. */

export const LIST_SNAPSHOT_KEYS = [
  "dreyz_learners",
  "dreyz_attendance",
  "dreyz_notices",
  "dreyz_schedule",
  "dreyz_courses",
  "dreyz_modules",
  "dreyz_instructors",
  "dreyz_assessments",
  "dreyz_projects",
  "dreyz_resources",
  "dreyz_grades",
  "dreyz_enrollments",
  "dreyz_users",
  "dreyz_payments",
  "dreyz_email_outbox",
  "dreyz_activity_log",
] as const;

export const TOMBSTONE_KEY = "dreyz_tombstones";

export type SchoolTombstones = {
  learnerIds: string[];
  emails: string[];
  userIds: string[];
};

const DEMO_LEARNER_IDS = new Set([
  "DRY001",
  "DRY002",
  "DRY003",
  "DRY004",
  "DRY005",
  "DRY006",
  "DRY007",
  "DRY008",
]);

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

export function emptyTombstones(): SchoolTombstones {
  return { learnerIds: [], emails: [], userIds: [] };
}

export function readTombstones(snapshot: Record<string, unknown> | null | undefined): SchoolTombstones {
  const raw = (snapshot?.[TOMBSTONE_KEY] ?? {}) as Partial<SchoolTombstones>;
  return {
    learnerIds: asIdList(raw.learnerIds),
    emails: asIdList(raw.emails).map((e) => e.toLowerCase()),
    userIds: asIdList(raw.userIds),
  };
}

export function mergeTombstones(
  a: SchoolTombstones,
  b: Partial<SchoolTombstones> | undefined
): SchoolTombstones {
  const extra = b ?? emptyTombstones();
  return {
    learnerIds: [...new Set([...a.learnerIds, ...asIdList(extra.learnerIds)])],
    emails: [
      ...new Set([...a.emails, ...asIdList(extra.emails).map((e) => e.toLowerCase())]),
    ],
    userIds: [...new Set([...a.userIds, ...asIdList(extra.userIds)])],
  };
}

export function isTombstoned(
  tombs: SchoolTombstones,
  opts: { id?: string; email?: string; userId?: string; learnerId?: string }
) {
  const id = opts.id || opts.learnerId || "";
  const email = (opts.email || "").trim().toLowerCase();
  const userId = opts.userId || "";
  if (id && tombs.learnerIds.includes(id)) return true;
  if (email && tombs.emails.includes(email)) return true;
  if (userId && tombs.userIds.includes(userId)) return true;
  return false;
}

function unionByIdIncomingWins(existing: unknown, incoming: unknown): unknown {
  if (!Array.isArray(incoming)) return existing ?? incoming;
  if (incoming.length === 0) return Array.isArray(existing) ? existing : incoming;
  if (!Array.isArray(existing) || existing.length === 0) return incoming;
  const map = new Map<string, Record<string, unknown>>();
  for (const row of existing) {
    if (row && typeof row === "object" && "id" in row && (row as { id?: unknown }).id) {
      map.set(String((row as { id: unknown }).id), row as Record<string, unknown>);
    }
  }
  for (const row of incoming) {
    if (row && typeof row === "object" && "id" in row && (row as { id?: unknown }).id) {
      const id = String((row as { id: unknown }).id);
      map.set(id, { ...(map.get(id) ?? {}), ...(row as Record<string, unknown>) });
    }
  }
  return [...map.values()];
}

function looksLikeDemoLearners(rows: unknown) {
  if (!Array.isArray(rows) || rows.length === 0) return false;
  return rows.every((row) => {
    const id =
      row && typeof row === "object" && "id" in row ? String((row as { id: unknown }).id) : "";
    return DEMO_LEARNER_IDS.has(id);
  });
}

function rowId(row: unknown) {
  if (row && typeof row === "object" && "id" in row) return String((row as { id: unknown }).id ?? "");
  return "";
}

function rowEmail(row: unknown) {
  if (!row || typeof row !== "object") return "";
  const rec = row as Record<string, unknown>;
  return String(rec.email ?? rec.learnerEmail ?? rec.learner_email ?? "")
    .trim()
    .toLowerCase();
}

function rowLearnerId(row: unknown) {
  if (!row || typeof row !== "object") return "";
  const rec = row as Record<string, unknown>;
  return String(rec.learnerId ?? rec.learner_id ?? rec.learnerId ?? "");
}

/** Drop deleted identities from every school list. */
export function applyTombstones(snapshot: Record<string, unknown>): Record<string, unknown> {
  const tombs = readTombstones(snapshot);
  if (!tombs.learnerIds.length && !tombs.emails.length && !tombs.userIds.length) {
    return snapshot;
  }

  const next: Record<string, unknown> = { ...snapshot, [TOMBSTONE_KEY]: tombs };
  const dropRow = (row: unknown) =>
    !isTombstoned(tombs, {
      id: rowId(row),
      email: rowEmail(row),
      userId: rowId(row),
      learnerId: rowLearnerId(row),
    });

  for (const key of LIST_SNAPSHOT_KEYS) {
    const list = next[key];
    if (!Array.isArray(list)) continue;
    next[key] = list.filter(dropRow);
  }
  return next;
}

/**
 * Combine a browser snapshot with the live cloud snapshot without dropping
 * school records. Empty/demo lists from a stale device must not replace live data.
 * Tombstones still remove people who were deliberately deleted.
 */
export function combineSchoolSnapshots(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const combined: Record<string, unknown> = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (key === TOMBSTONE_KEY) continue;
    if ((LIST_SNAPSHOT_KEYS as readonly string[]).includes(key)) {
      if (key === "dreyz_learners" && looksLikeDemoLearners(value) && !looksLikeDemoLearners(existing[key])) {
        continue;
      }
      combined[key] = unionByIdIncomingWins(existing[key], value);
      continue;
    }
    combined[key] = value;
  }
  combined[TOMBSTONE_KEY] = mergeTombstones(
    readTombstones(existing),
    readTombstones(incoming)
  );
  return applyTombstones(combined);
}

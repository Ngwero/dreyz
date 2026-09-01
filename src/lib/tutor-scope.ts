import { getAllUsers } from "@/lib/auth";
import { coursesStore, instructorsStore } from "@/lib/store";
import type { SessionUser } from "@/lib/types";

/**
 * Course titles a tutor may mark (from assignedCourseIds).
 * `null` = not a tutor (no filter). Empty array = tutor with no assignments.
 */
export function tutorAssignedCourseTitles(user: SessionUser | null | undefined): string[] | null {
  if (!user || user.role !== "tutor") return null;
  const account = getAllUsers().find(
    (u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
  );
  const instructor =
    instructorsStore.getAll().find((i) => i.id === (user.instructorId || account?.instructorId)) ||
    instructorsStore.getAll().find((i) => i.email.toLowerCase() === user.email.toLowerCase());
  const ids = instructor?.assignedCourseIds ?? [];
  if (!ids.length) return [];
  return coursesStore
    .getAll()
    .filter((c) => ids.includes(c.id))
    .map((c) => c.title);
}

export function courseAllowedForTutor(courseTitle: string, allowed: string[] | null): boolean {
  if (allowed === null) return true;
  if (!allowed.length) return false;
  const n = courseTitle.toLowerCase();
  return allowed.some(
    (t) =>
      t.toLowerCase() === n || n.includes(t.toLowerCase()) || t.toLowerCase().includes(n)
  );
}

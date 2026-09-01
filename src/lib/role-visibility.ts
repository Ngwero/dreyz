"use client";

import { queueCloudPush } from "./store";
import type { UserRole } from "./types";

/** Routes each role may open under /portal before Super Admin toggles. */
export const ROLE_ROUTES: Record<UserRole, string[]> = {
  super_admin: ["*"],
  accountant: [
    "/",
    "/admissions",
    "/enrollments",
    "/payments",
    "/learners",
    "/accounts",
    "/account",
    "/settings",
    "/notices",
    "/resources",
    "/certificates",
  ],
  tutor: [
    "/",
    "/schedule",
    "/attendance",
    "/assessments",
    "/projects",
    "/learners",
    "/courses",
    "/modules",
    "/resources",
    "/notices",
    "/account",
    "/certificates",
  ],
  student: [
    "/",
    "/schedule",
    "/attendance",
    "/assessments",
    "/projects",
    "/resources",
    "/notices",
    "/account",
    "/enrollments",
    "/certificates",
  ],
};

export type ConfigurableRole = Exclude<UserRole, "super_admin">;

export const PAGE_FEATURES = [
  { id: "admissions", label: "Admissions", group: "Academics" },
  { id: "courses", label: "Courses", group: "Academics" },
  { id: "modules", label: "Modules", group: "Academics" },
  { id: "schedule", label: "Schedule", group: "Academics" },
  { id: "attendance", label: "Attendance", group: "Academics" },
  { id: "assessments", label: "Assessments", group: "Academics" },
  { id: "projects", label: "Projects & portfolio", group: "Academics" },
  { id: "certificates", label: "Certificates & transcripts", group: "Academics" },
  { id: "learners", label: "Learners", group: "People" },
  { id: "enrollments", label: "Enrollments & billing", group: "People" },
  { id: "instructors", label: "Tutors", group: "People" },
  { id: "accounts", label: "Staff accounts", group: "People" },
  { id: "payments", label: "Payments", group: "Operations" },
  { id: "resources", label: "Resources", group: "Operations" },
  { id: "notices", label: "Notices", group: "Operations" },
  { id: "settings", label: "Settings", group: "Operations" },
] as const;

export type PageFeatureId = (typeof PAGE_FEATURES)[number]["id"];
export type RolePageFlags = Record<PageFeatureId, boolean>;
export type RolePages = Record<ConfigurableRole, RolePageFlags>;

const KEY = "dreyz_role_pages";

const FEATURE_IDS = PAGE_FEATURES.map((f) => f.id);

function flagsFromRoutes(role: ConfigurableRole): RolePageFlags {
  const routes = ROLE_ROUTES[role];
  const flags = {} as RolePageFlags;
  for (const id of FEATURE_IDS) {
    flags[id] = routes.includes(`/${id}`);
  }
  return flags;
}

export function defaultRolePages(): RolePages {
  return {
    accountant: flagsFromRoutes("accountant"),
    tutor: flagsFromRoutes("tutor"),
    student: flagsFromRoutes("student"),
  };
}

function mergeFlags(stored: Partial<RolePageFlags> | undefined, fallback: RolePageFlags): RolePageFlags {
  const next = { ...fallback };
  if (!stored) return next;
  for (const id of FEATURE_IDS) {
    if (typeof stored[id] === "boolean") next[id] = stored[id]!;
  }
  return next;
}

export function getRolePages(): RolePages {
  const defaults = defaultRolePages();
  if (typeof window === "undefined") return forceStudentEssentials(defaults);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return forceStudentEssentials(defaults);
    const stored = JSON.parse(raw) as Partial<RolePages>;
    return forceStudentEssentials({
      accountant: mergeFlags(stored.accountant, defaults.accountant),
      tutor: mergeFlags(stored.tutor, defaults.tutor),
      student: mergeFlags(stored.student, defaults.student),
    });
  } catch {
    return forceStudentEssentials(defaults);
  }
}

/** Schedule + notices always stay on for students so staff posts appear automatically. */
function forceStudentEssentials(pages: RolePages): RolePages {
  return {
    ...pages,
    student: {
      ...pages.student,
      schedule: true,
      notices: true,
    },
  };
}

export function saveRolePages(pages: RolePages) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(forceStudentEssentials(pages)));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: KEY } }));
  queueCloudPush();
}

export function setRolePage(role: ConfigurableRole, id: PageFeatureId, on: boolean) {
  if (role === "student" && (id === "schedule" || id === "notices") && !on) {
    return getRolePages();
  }
  const pages = getRolePages();
  pages[role] = { ...pages[role], [id]: on };
  saveRolePages(pages);
  return pages;
}

export function portalPath(pathname: string): string {
  const path = pathname.replace(/^\/portal/, "") || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function featureIdFromPath(pathname: string): PageFeatureId | null {
  const path = portalPath(pathname);
  const id = path.split("/").filter(Boolean)[0];
  return FEATURE_IDS.includes(id as PageFeatureId) ? (id as PageFeatureId) : null;
}

export function roleCanSeePath(role: UserRole, pathname: string): boolean {
  if (role === "super_admin") return true;

  const path = portalPath(pathname);
  if (path === "/" || path === "") return true;
  if (path === "/account" || path.startsWith("/account/")) return true;
  if (path === "/access" || path.startsWith("/access/")) return false;
  if (path === "/activity" || path.startsWith("/activity/")) return false;

  const id = featureIdFromPath(path);
  if (!id) return false;
  return getRolePages()[role][id] === true;
}

export const PAGE_GROUPS = ["Academics", "People", "Operations"] as const;

import type { UserRole } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  accountant: "Accountant",
  tutor: "Tutor",
  student: "Student",
};

/** Routes each role may open under /portal */
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
    "/activity",
    "/settings",
    "/notices",
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
    "/activity",
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
    "/activity",
    "/enrollments",
  ],
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const routes = ROLE_ROUTES[role];
  if (routes.includes("*")) return true;

  const path = pathname.replace(/^\/portal/, "") || "/";
  return routes.some((r) => {
    if (r === "/") return path === "/" || path === "";
    return path === r || path.startsWith(`${r}/`);
  });
}

export function roleHomeEyebrow(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "Administration";
    case "accountant":
      return "Finance";
    case "tutor":
      return "Teaching";
    case "student":
      return "My Learning";
  }
}

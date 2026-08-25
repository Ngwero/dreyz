import type { UserRole } from "./types";
import { ROLE_ROUTES, roleCanSeePath } from "./role-visibility";

export { ROLE_ROUTES };

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  accountant: "Accountant",
  tutor: "Tutor",
  student: "Student",
};

export function canAccessRoute(role: UserRole, pathname: string): boolean {
  return roleCanSeePath(role, pathname);
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

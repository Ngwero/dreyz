"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { GuidedTour, type TourStep } from "./GuidedTour";
import type { UserRole } from "@/lib/types";

export const portalTourKey = (role: UserRole) => `dreyz_portal_tour_${role}_v1`;

const shared: TourStep[] = [
  {
    selector: '[data-tour="nav-sidebar"]',
    title: "Your tools",
    body: "Everything for your role lives here — open a page any time from this menu.",
    pad: 8,
  },
  {
    selector: '[data-tour="header-search"]',
    title: "Search the school",
    body: "Find learners, courses, notices, and accounts without leaving the page.",
    pad: 8,
  },
  {
    selector: '[data-tour="portal-main"]',
    title: "Your dashboard",
    body: "A live snapshot of what matters today. Stats and lists update as you work.",
    pad: 10,
  },
];

const roleFinale: Record<UserRole, TourStep> = {
  super_admin: {
    selector: '[data-tour="nav-accounts"]',
    title: "Manage every login",
    body: "Create Student, Tutor, Accountant, and Super Admin accounts. New users are emailed a temporary password.",
    pad: 6,
  },
  accountant: {
    selector: '[data-tour="nav-payments"]',
    title: "Confirm fees, open access",
    body: "Record a payment and the student portal login is created and emailed automatically.",
    pad: 6,
  },
  tutor: {
    selector: '[data-tour="nav-attendance"]',
    title: "Bulk attendance",
    body: "Mark a whole class present, late, or absent in one pass — then save the roll.",
    pad: 6,
  },
  student: {
    selector: '[data-tour="header-profile"]',
    title: "Your profile",
    body: "Update your details, change your password, and check fees, projects, and attendance.",
    pad: 6,
  },
};

export function PortalTour() {
  const { user, loading } = useAuth();
  if (loading || !user) return null;

  return (
    <GuidedTour
      storageKey={portalTourKey(user.role)}
      steps={[...shared, roleFinale[user.role]]}
      variant="portal"
      startDelay={600}
    />
  );
}

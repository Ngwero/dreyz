"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PortalTour } from "@/components/tour/PortalTour";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const openNavForTour = useCallback(() => setNavOpen(true), []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  return (
    <RequireAuth>
      <div className="min-h-screen portal-shell">
        <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
        <div className="flex min-h-screen flex-col lg:ml-[260px]">
          <Header onMenuClick={() => setNavOpen(true)} />
          <main
            data-tour="portal-main"
            className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7"
          >
            {children}
          </main>
        </div>
        <PortalTour onStart={openNavForTour} />
      </div>
    </RequireAuth>
  );
}

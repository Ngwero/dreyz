"use client";

import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PortalTour } from "@/components/tour/PortalTour";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="ml-[260px] flex min-h-screen flex-col">
          <Header />
          <main data-tour="portal-main" className="flex-1 px-7 py-6">
            {children}
          </main>
        </div>
        <PortalTour />
      </div>
    </RequireAuth>
  );
}

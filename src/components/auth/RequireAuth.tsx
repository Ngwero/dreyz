"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { canAccessRoute } from "@/lib/roles";
import { LottieScreen } from "@/components/ui/LottieLoader";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canAccessRoute(user.role, pathname)) {
      router.replace("/portal");
    }
  }, [user, loading, pathname, router]);

  if (loading || !user) {
    return <LottieScreen label="Signing you in…" />;
  }

  if (!canAccessRoute(user.role, pathname)) {
    return <LottieScreen label="Taking you there…" />;
  }

  return <>{children}</>;
}

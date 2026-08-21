import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Dreyz Interior Design School | Learn · Design · Inspire",
  description:
    "Professional interior design training in Kyaliwajjala. 4-month course with optional 2-month internship. Login to the school portal.",
};

export default function HomePage() {
  return <LandingPage />;
}

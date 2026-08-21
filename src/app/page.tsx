import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/LandingPage";

export const metadata: Metadata = {
  title: "Dreyz Interior Design School | Learn · Design · Inspire",
  description:
    "January 2027 intake open. Professional interior design training in Kyaliwajjala — 4-month main course or 6-month with internship. Physical classes only.",
};

export default function HomePage() {
  return <LandingPage />;
}

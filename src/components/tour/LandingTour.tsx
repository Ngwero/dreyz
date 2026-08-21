"use client";

import { GuidedTour, type TourStep } from "./GuidedTour";

export const LANDING_TOUR_KEY = "dreyz_landing_tour_v1";

export const landingTourSteps: TourStep[] = [
  {
    selector: '[data-tour="hero"]',
    title: "Welcome to Dreyz",
    body: "This is where your interior design career starts — studio craft, technical drawing, and site practice in Kyaliwajjala.",
    pad: 10,
  },
  {
    selector: '[data-tour="nav"]',
    title: "Find your way",
    body: "Jump to Programme, Studio, About, Admissions, or Contact. Portal takes enrolled students and staff to their dashboard.",
    pad: 8,
  },
  {
    selector: '[data-tour="about"]',
    title: "Learn · Design · Inspire",
    body: "Dreyz trains designers who can quote, draw, style, and deliver — skills you can sell from day one.",
  },
  {
    selector: '[data-tour="programme"]',
    title: "Pick your class",
    body: "Weekday or Saturday sessions. Same practical units, on a timetable that fits your life.",
  },
  {
    selector: '[data-tour="studio"]',
    title: "Life at the school",
    body: "Studio collaboration, graduation, and the community behind every Dreyz designer.",
  },
  {
    selector: '[data-tour="admissions"]',
    title: "Fees & payment plans",
    body: "Choose a 4-month or 6-month track, pay in installments, and graduate with a certificate that opens doors.",
  },
  {
    selector: '[data-tour="contact"]',
    title: "Take the next step",
    body: "Visit us in Kyaliwajjala, call the team, or apply now. Limited intake — claim your seat when you’re ready.",
  },
];

export function LandingTour() {
  return (
    <GuidedTour
      storageKey={LANDING_TOUR_KEY}
      steps={landingTourSteps}
      variant="landing"
      startDelay={1100}
    />
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  Assessment,
  AttendanceRecord,
  Course,
  Enrollment,
  Grade,
  Instructor,
  Learner,
  Module,
  Notice,
  Project,
  Resource,
  ScheduleItem,
} from "./types";
import {
  assessments as seedAssessments,
  attendance as seedAttendance,
  courses as seedCourses,
  instructors as seedInstructors,
  learners as seedLearners,
  modules as seedModules,
  notices as seedNotices,
  projects as seedProjects,
  resources as seedResources,
  schedule as seedSchedule,
  schoolInfo as seedSchoolInfo,
} from "./data";
import { normalizeCourse } from "./course-structure";

function isBrowser() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const STORE_KEYS = [
  "dreyz_learners",
  "dreyz_attendance",
  "dreyz_notices",
  "dreyz_schedule",
  "dreyz_courses",
  "dreyz_modules",
  "dreyz_instructors",
  "dreyz_assessments",
  "dreyz_projects",
  "dreyz_resources",
  "dreyz_grades",
  "dreyz_enrollments",
  "dreyz_settings",
  "dreyz_users",
  "dreyz_payments",
] as const;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

function collectSnapshot() {
  if (!isBrowser()) return {};
  const data: Record<string, unknown> = {};
  for (const key of STORE_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      /* skip */
    }
  }
  return data;
}

function applySnapshot(data: Record<string, unknown>) {
  if (!isBrowser() || !data) return;
  for (const [key, value] of Object.entries(data)) {
    if (!STORE_KEYS.includes(key as (typeof STORE_KEYS)[number])) continue;
    localStorage.setItem(key, JSON.stringify(value));
  }
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: "*" } }));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: "*" } }));
}

export function queueCloudPush() {
  if (!isBrowser()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void fetch("/api/school-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: collectSnapshot() }),
    }).catch(() => {
      /* offline */
    });
  }, 500);
}

export async function hydrateSchoolData() {
  if (!isBrowser() || hydrated) return;
  hydrated = true;
  try {
    const res = await fetch("/api/school-data", { cache: "no-store" });
    const json = (await res.json()) as { ok?: boolean; data?: Record<string, unknown> };
    if (res.ok && json.ok && json.data && Object.keys(json.data).length > 0) {
      applySnapshot(json.data);
    } else {
      queueCloudPush();
    }
  } catch {
    /* keep local copy */
  }
}

function writeJson(key: string, value: unknown) {
  if (!isBrowser()) return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key } }));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key } }));
  queueCloudPush();
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 99)}`;
}

/** Generic list store: seed until first write, then localStorage is source of truth */
function createListStore<T extends { id: string }>(key: string, seed: T[]) {
  const getAll = () => {
    if (!isBrowser()) return seed;
    const stored = localStorage.getItem(key);
    if (!stored) return seed;
    try {
      return JSON.parse(stored) as T[];
    } catch {
      return seed;
    }
  };
  const upsert = (item: T) => {
    const all = [...getAll()];
    const i = all.findIndex((x) => x.id === item.id);
    if (i >= 0) all[i] = item;
    else all.unshift(item);
    writeJson(key, all);
    return item;
  };
  const upsertMany = (items: T[]) => {
    const all = [...getAll()];
    for (const item of items) {
      const i = all.findIndex((x) => x.id === item.id);
      if (i >= 0) all[i] = item;
      else all.unshift(item);
    }
    writeJson(key, all);
  };
  const remove = (id: string) => {
    writeJson(
      key,
      getAll().filter((x) => x.id !== id)
    );
  };
  const replaceAll = (items: T[]) => writeJson(key, items);
  return { getAll, upsert, upsertMany, remove, replaceAll, key };
}

export const learnersStore = createListStore("dreyz_learners", seedLearners);
export const attendanceStore = createListStore("dreyz_attendance", seedAttendance);
export const noticesStore = createListStore("dreyz_notices", seedNotices);
export const scheduleStore = createListStore("dreyz_schedule", seedSchedule);
export const coursesStore = createListStore(
  "dreyz_courses",
  seedCourses.map(normalizeCourse)
);
export const modulesStore = createListStore("dreyz_modules", seedModules);
export const instructorsStore = createListStore("dreyz_instructors", seedInstructors);
export const assessmentsStore = createListStore("dreyz_assessments", seedAssessments);
export const projectsStore = createListStore("dreyz_projects", seedProjects);
export const resourcesStore = createListStore("dreyz_resources", seedResources);
export const gradesStore = createListStore<Grade>("dreyz_grades", []);
export const enrollmentsStore = createListStore<Enrollment>("dreyz_enrollments", []);

export type SchoolSettings = {
  name: string;
  tagline: string;
  location: string;
  email: string;
  phones: string;
  website: string;
  primaryColor: string;
  accentColor: string;
  notifyEnrollments: boolean;
  notifyAttendance: boolean;
  notifyAssessments: boolean;
  notifyNotices: boolean;
  stripeConnected: boolean;
  zoomConnected: boolean;
  mailchimpConnected: boolean;
  rukaPayConnected: boolean;
};

const SETTINGS_KEY = "dreyz_settings";

export function getSettings(): SchoolSettings {
  return readJson<SchoolSettings>(SETTINGS_KEY, {
    name: seedSchoolInfo.name,
    tagline: seedSchoolInfo.tagline,
    location: seedSchoolInfo.location,
    email: seedSchoolInfo.email,
    phones: seedSchoolInfo.phones.join(" / "),
    website: seedSchoolInfo.website,
    primaryColor: "#082878",
    accentColor: "#1b7eef",
    notifyEnrollments: true,
    notifyAttendance: true,
    notifyAssessments: true,
    notifyNotices: false,
    stripeConnected: true,
    zoomConnected: true,
    mailchimpConnected: false,
    rukaPayConnected: false,
  });
}

export function saveSettings(settings: SchoolSettings) {
  writeJson(SETTINGS_KEY, settings);
}

export function upsertLearnerFromPayment(input: {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  status?: Learner["status"];
}) {
  const existing = learnersStore.getAll().find((l) => l.id === input.id);
  learnersStore.upsert({
    id: input.id,
    name: input.name,
    email: input.email,
    phone: input.phone,
    course: input.course,
    enrollmentDate: existing?.enrollmentDate ?? new Date().toISOString().slice(0, 10),
    progress: existing?.progress ?? 0,
    status: input.status ?? existing?.status ?? "active",
    paidAmount: existing?.paidAmount,
    feeDue: existing?.feeDue,
  });
}

export function saveBulkAttendance(
  entries: {
    learnerId: string;
    learnerName: string;
    course: string;
    date: string;
    status: AttendanceRecord["status"];
  }[]
) {
  const all = [...attendanceStore.getAll()];
  for (const entry of entries) {
    const existing = all.find(
      (r) =>
        r.learnerId === entry.learnerId &&
        r.date === entry.date &&
        r.course === entry.course
    );
    const record: AttendanceRecord = existing
      ? { ...existing, status: entry.status, learnerName: entry.learnerName }
      : { id: uid("ATT"), ...entry };
    const i = all.findIndex((x) => x.id === record.id);
    if (i >= 0) all[i] = record;
    else all.unshift(record);
  }
  attendanceStore.replaceAll(all);
}

export function allCourseTitles() {
  const titles = new Set<string>();
  for (const c of coursesStore.getAll()) if (c.title) titles.add(c.title);
  for (const l of learnersStore.getAll()) if (l.course) titles.add(l.course);
  for (const s of scheduleStore.getAll()) if (s.course) titles.add(s.course);
  return [...titles].sort((a, b) => a.localeCompare(b));
}

export function datesInRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [from];
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${day}`);
  }
  return dates;
}

export function monthRange(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${yearMonth}-01`,
    to: `${yearMonth}-${String(last).padStart(2, "0")}`,
  };
}

export function upsertInstructorFromAccount(input: {
  id: string;
  name: string;
  email: string;
  specialty: string;
  status?: Instructor["status"];
}) {
  const existing = instructorsStore.getAll().find((i) => i.id === input.id);
  const keepSuspended =
    existing?.status === "suspended" && input.status !== "active";
  const keepOnLeave =
    existing?.status === "on-leave" && (input.status === "active" || !input.status);
  instructorsStore.upsert({
    id: input.id,
    name: input.name,
    email: input.email,
    phone: existing?.phone,
    specialty: input.specialty,
    courses: existing?.assignedCourseIds?.length ?? existing?.courses ?? 1,
    rating: existing?.rating ?? 4.8,
    status: keepSuspended
      ? "suspended"
      : keepOnLeave
        ? "on-leave"
        : (input.status ?? existing?.status ?? "active"),
    assignedCourseIds: existing?.assignedCourseIds,
  });
}

export function exportCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadIcs(item: ScheduleItem) {
  const start = item.date.replace(/-/g, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `SUMMARY:${item.title}`,
    `DESCRIPTION:${item.course} with ${item.instructor}`,
    `DTSTART;VALUE=DATE:${start}`,
    `LOCATION:Dreyz Interior Design School`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${item.title.replace(/\s+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/** React hook to subscribe to store changes */
export function useStoreList<T extends { id: string }>(
  getAll: () => T[],
  storeKey: string
): [T[], () => void] {
  const [items, setItems] = useState<T[]>([]);
  const refresh = useCallback(() => setItems(getAll()), [getAll]);

  useEffect(() => {
    void hydrateSchoolData().then(refresh);
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === storeKey || e.key === "*") refresh();
    };
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as { key?: string } | undefined;
      if (!detail?.key || detail.key === "*" || detail.key === storeKey) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("dreyz-store", onCustom);
    window.addEventListener("dreyz-store", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("dreyz-store", onCustom);
      window.removeEventListener("dreyz-store", onCustom);
    };
  }, [refresh, storeKey]);

  return [items, refresh];
}

export function useLiveTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    bump();
    void hydrateSchoolData().then(bump);
    window.addEventListener("storage", bump);
    window.addEventListener("dreyz-store", bump);
    return () => {
      window.removeEventListener("storage", bump);
      window.removeEventListener("dreyz-store", bump);
    };
  }, []);
  return tick;
}

export { uid };

export type {
  Assessment,
  AttendanceRecord,
  Course,
  Grade,
  Instructor,
  Learner,
  Module,
  Notice,
  Project,
  Resource,
  ScheduleItem,
};

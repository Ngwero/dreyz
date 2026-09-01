import type { FeeTrack } from "@/lib/types";
import { feeTracks as seedFeeTracks } from "@/lib/data";

const KEY = "dreyz_fee_tracks";

function isBrowser() {
  return typeof window !== "undefined";
}

/** Live fee catalogue — Settings can override the seeded list. */
export function getFeeTracks(): FeeTrack[] {
  if (!isBrowser()) return seedFeeTracks;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedFeeTracks;
    const parsed = JSON.parse(raw) as FeeTrack[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedFeeTracks;
    return parsed;
  } catch {
    return seedFeeTracks;
  }
}

export function saveFeeTracks(tracks: FeeTrack[]) {
  if (!isBrowser()) return;
  localStorage.setItem(KEY, JSON.stringify(tracks));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: KEY } }));
  void import("@/lib/store").then((m) => m.queueCloudPush());
}

export function publicFeeTracksLive() {
  return getFeeTracks().filter((t) => !t.legacy);
}

export function feeTrackById(id?: string) {
  if (!id) return undefined;
  return getFeeTracks().find((t) => t.id === id);
}

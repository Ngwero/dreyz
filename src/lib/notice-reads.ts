const KEY = "dreyz_notice_reads";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getReadNoticeIds(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function markNoticeRead(id: string) {
  if (!isBrowser()) return;
  const set = new Set(getReadNoticeIds());
  set.add(id);
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: KEY } }));
}

export function markAllNoticesRead(ids: string[]) {
  if (!isBrowser()) return;
  const set = new Set(getReadNoticeIds());
  for (const id of ids) set.add(id);
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: KEY } }));
}

export function unreadNoticeCount(noticeIds: string[]) {
  const read = new Set(getReadNoticeIds());
  return noticeIds.filter((id) => !read.has(id)).length;
}

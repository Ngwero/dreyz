import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { noticeEmailHtml, sendMail } from "@/lib/mail";
import { portalNoticesUrl } from "@/lib/portal-url";

export const runtime = "nodejs";

type NoticeRow = {
  id: string;
  title: string;
  content: string | null;
  date: string | null;
  priority: string | null;
  category: string | null;
};

async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: me } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!me || (me.role !== "super_admin" && me.role !== "accountant")) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "Not allowed to post notices." }, { status: 403 }),
    };
  }
  return { ok: true as const, admin };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notices")
      .select("id, title, content, date, priority, category")
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const notices = ((data ?? []) as NoticeRow[]).map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content ?? "",
      date: row.date ?? "",
      priority: (row.priority as "low" | "medium" | "high") || "medium",
      category: row.category ?? "General",
    }));

    return NextResponse.json({ ok: true, notices });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const gated = await requireStaff();
    if (!gated.ok) return gated.response;
    const admin = gated.admin;

    const body = (await request.json()) as {
      id?: string;
      title?: string;
      content?: string;
      priority?: string;
      category?: string;
      date?: string;
    };

    const title = String(body.title ?? "").trim();
    const content = String(body.content ?? "").trim();
    if (!title || !content) {
      return NextResponse.json({ ok: false, error: "Enter a title and message." }, { status: 400 });
    }

    const notice = {
      id: String(body.id ?? "").trim() || `NTC-${Date.now().toString(36).toUpperCase()}`,
      title,
      content,
      date: String(body.date ?? new Date().toISOString().slice(0, 10)),
      priority: ["low", "medium", "high"].includes(String(body.priority)) ? String(body.priority) : "medium",
      category: String(body.category ?? "General").trim() || "General",
    };

    const { error: saveError } = await admin.from("notices").upsert(notice, { onConflict: "id" });
    if (saveError) {
      return NextResponse.json({ ok: false, error: saveError.message }, { status: 500 });
    }

    const [{ data: profiles }, { data: learners }] = await Promise.all([
      admin.from("profiles").select("email, name, status"),
      admin.from("learners").select("email, name, status"),
    ]);

    const recipients = new Map<string, string>();
    for (const row of profiles ?? []) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (!email.includes("@")) continue;
      if (row.status && row.status !== "active") continue;
      recipients.set(email, String(row.name ?? "there").split(" ")[0] || "there");
    }
    for (const row of learners ?? []) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (!email.includes("@")) continue;
      if (row.status === "paused") continue;
      if (!recipients.has(email)) {
        recipients.set(email, String(row.name ?? "there").split(" ")[0] || "there");
      }
    }

    const portalUrl = portalNoticesUrl();
    const list = [...recipients.entries()];
    let emailed = 0;
    let failed = 0;

    for (const [email, name] of list) {
      try {
        await sendMail({
          to: email,
          subject: `You have received this notice: ${notice.title}`,
          text: [
            `Hi ${name},`,
            ``,
            `You have received this school notice from Dreyz Interior Design School.`,
            ``,
            notice.title,
            notice.content,
            ``,
            `Read it in the portal: ${portalUrl}`,
            ``,
            `— Dreyz Interior Design School`,
          ].join("\n"),
          html: noticeEmailHtml({
            name,
            title: notice.title,
            content: notice.content,
            category: notice.category,
            portalUrl,
          }),
        });
        emailed += 1;
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      notice,
      emailed,
      failed,
      recipients: list.length,
      message:
        failed > 0
          ? `Notice posted. Emailed ${emailed} people. ${failed} emails failed.`
          : `Notice posted to the portal and emailed to ${emailed} people.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

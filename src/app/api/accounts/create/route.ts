import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, welcomeAccountHtml } from "@/lib/mail";
import { portalLoginUrl } from "@/lib/portal-url";
import { classOptions, feeTracks, schoolInfo } from "@/lib/data";

const ROLES = ["super_admin", "accountant", "tutor", "student"] as const;
type Role = (typeof ROLES)[number];

function roleLabel(role: Role) {
  if (role === "super_admin") return "Super Admin";
  if (role === "accountant") return "Accountant";
  if (role === "tutor") return "Tutor";
  return "Student";
}

function generatePassword(length = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "")
      .trim()
      .toLowerCase();
    const phone = String(body.phone ?? "").trim() || null;
    const role = String(body.role ?? "student") as Role;
    const feeTrackId =
      role === "student" ? String(body.feeTrackId ?? "").trim() || null : null;
    const classOptionId =
      role === "student" ? String(body.classOptionId ?? "").trim() || null : null;
    const specialty =
      role === "tutor" ? String(body.specialty ?? "").trim() || null : null;

    if (!name || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid name and email." },
        { status: 400 }
      );
    }
    if (!ROLES.includes(role)) {
      return NextResponse.json({ ok: false, error: "Invalid role." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, name, role, phone, fee_track_id, class_option_id, specialty")
      .eq("email", email)
      .maybeSingle();

    const resendIfExists = Boolean(body.resendIfExists);

    if (existingProfile) {
      if (!resendIfExists) {
        return NextResponse.json(
          { ok: false, error: "An account with this email already exists." },
          { status: 409 }
        );
      }

      const password = generatePassword();
      const { error: pwError } = await admin.auth.admin.updateUserById(
        existingProfile.id,
        { password, email_confirm: true }
      );
      if (pwError) {
        return NextResponse.json({ ok: false, error: pwError.message }, { status: 500 });
      }

      const existingRole = (existingProfile.role as Role) || role;
      const loginUrl = portalLoginUrl();
      const label = roleLabel(existingRole);
      const firstName = String(existingProfile.name || name).split(" ")[0] || "there";
      await sendMail({
        to: email,
        subject:
          existingRole === "student"
            ? "Your Dreyz Interior Design School login"
            : `Your Dreyz Interior ${label} login`,
        text: [
          `Hi ${firstName},`,
          ``,
          `Your portal login is ready.`,
          ``,
          `Portal: ${loginUrl}`,
          `Email: ${email}`,
          `Temporary password: ${password}`,
          ``,
          `Sign in and change your password from My Account.`,
          ``,
          `— Dreyz Interior Design School`,
        ].join("\n"),
        html: welcomeAccountHtml({
          name: firstName,
          roleLabel: label,
          portalUrl: loginUrl,
          email,
          password,
          extras: [],
        }),
      });

      return NextResponse.json({
        ok: true,
        alreadyExists: true,
        password,
        message: `Login details emailed to ${email}`,
      });
    }

    const password =
      typeof body.password === "string" && body.password.length >= 6
        ? body.password
        : generatePassword();
    const learnerId =
      role === "student"
        ? String(body.learnerId ?? "").trim() ||
          `DRY${Date.now().toString(36).toUpperCase().slice(-5)}`
        : null;
    const instructorId =
      role === "tutor"
        ? String(body.instructorId ?? "").trim() ||
          `INS${Date.now().toString(36).toUpperCase().slice(-5)}`
        : null;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { ok: false, error: createError?.message ?? "Could not create auth user." },
        { status: 500 }
      );
    }

    const userId = created.user.id;
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email,
        name,
        role,
        phone,
        status: "active",
        learner_id: learnerId,
        instructor_id: instructorId,
        fee_track_id: feeTrackId,
        class_option_id: classOptionId,
        specialty,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { ok: false, error: profileError.message },
        { status: 500 }
      );
    }

    if (role === "student" && learnerId) {
      const track = feeTracks.find((t) => t.id === feeTrackId);
      await admin.from("learners").upsert(
        {
          id: learnerId,
          name,
          email,
          phone,
          course: track?.name ?? "Interior Design",
          enrollment_date: new Date().toISOString().slice(0, 10),
          progress: 0,
          status: "active",
          paid_amount: 0,
          fee_due: track?.total ?? 3_350_000,
        },
        { onConflict: "id" }
      );
      const { data: existingPays } = await admin
        .from("payments")
        .select("amount, status")
        .eq("learner_email", email);
      const paid = (existingPays ?? [])
        .filter((p) => p.status === "confirmed")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      if (paid > 0) {
        await admin
          .from("learners")
          .update({ paid_amount: paid, status: paid >= 1_000_000 ? "active" : "paused" })
          .eq("id", learnerId);
      }
    }

    const label = roleLabel(role);
    const loginUrl = portalLoginUrl();
    const track = feeTracks.find((t) => t.id === (feeTrackId || ""));
    const klass = classOptions.find((c) => c.id === (classOptionId || ""));
    const extras =
      role === "student"
        ? [
            `Programme: ${track?.name ?? "Interior Design"}`,
            `Class: ${klass?.name ?? "—"} (${klass?.days ?? ""} · ${klass?.time ?? ""})`,
          ]
        : role === "tutor" && specialty
          ? [`Specialty: ${specialty}`]
          : [];

    const isStudent = role === "student";
    const subject = isStudent
      ? "Welcome to Dreyz Interior Design School"
      : `Your Dreyz Interior ${label} access`;

    const text = isStudent
      ? [
          `Hi ${name.split(" ")[0] || name},`,
          ``,
          `Welcome to Dreyz Interior Design School.`,
          ``,
          `Your student portal is ready.`,
          ...extras,
          ``,
          `Student login`,
          `Portal: ${loginUrl}`,
          `Email: ${email}`,
          `Temporary password: ${password}`,
          ``,
          `Sign in and change your password from My Account.`,
          ``,
          `Questions? ${schoolInfo.email} · ${schoolInfo.phones.join(" / ")}`,
          ``,
          `— Dreyz Interior Design School`,
        ].join("\n")
      : [
          `Hi ${name.split(" ")[0] || name},`,
          ``,
          `You have been added to the Dreyz Interior staff portal.`,
          ``,
          `Your role is ${label}. This is an administration login — not a student account.`,
          ...extras,
          ``,
          `Staff login`,
          `Portal: ${loginUrl}`,
          `Email: ${email}`,
          `Temporary password: ${password}`,
          ``,
          `Please sign in and change your password from My Account. Keep these details private.`,
          ``,
          `Questions? ${schoolInfo.email} · ${schoolInfo.phones.join(" / ")}`,
          ``,
          `— Dreyz Interior Design School`,
        ].join("\n");

    await sendMail({
      to: email,
      subject,
      text,
      html: welcomeAccountHtml({
        name: name.split(" ")[0] || name,
        roleLabel: label,
        portalUrl: loginUrl,
        email,
        password,
        extras,
      }),
    });

    return NextResponse.json({
      ok: true,
      message: `Welcome email sent to ${email}`,
      user: {
        id: userId,
        name,
        email,
        role,
        phone,
        status: "active" as const,
        learnerId: learnerId ?? undefined,
        instructorId: instructorId ?? undefined,
        feeTrackId: feeTrackId ?? undefined,
        classOptionId: classOptionId ?? undefined,
        specialty: specialty ?? undefined,
        createdAt: new Date().toISOString().slice(0, 10),
      },
      password,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[accounts create]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

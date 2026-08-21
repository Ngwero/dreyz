#!/usr/bin/env node
/**
 * Seed Supabase Auth users + profiles for Dreyz demo accounts.
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    let val = trimmed.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const DEMO_PASSWORD = "dreyz2026";

const SEED = [
  {
    email: "admin@dreyzinteriorug.com",
    name: "Dreyz Super Admin",
    role: "super_admin",
    phone: "+256 700 000 001",
  },
  {
    email: "accounts@dreyzinteriorug.com",
    name: "Sarah Namukasa",
    role: "accountant",
    phone: "+256 700 000 002",
  },
  {
    email: "elena@dreyzinteriorug.com",
    name: "Elena Vasquez",
    role: "tutor",
    specialty: "Residential & colour theory",
    instructor_id: "INS001",
  },
  {
    email: "marcus@dreyzinteriorug.com",
    name: "Marcus Webb",
    role: "tutor",
    specialty: "Lighting & spatial planning",
    instructor_id: "INS002",
  },
  {
    email: "grace.n@email.com",
    name: "Grace Nakato",
    role: "student",
    phone: "+256 712 345 678",
    learner_id: "DRY007",
    fee_track_id: "4-month",
    class_option_id: "weekday",
  },
  {
    email: "amara.o@email.com",
    name: "Amara Okafor",
    role: "student",
    phone: "+234 801 234 5678",
    learner_id: "DRY001",
    fee_track_id: "6-month",
    class_option_id: "saturday",
  },
];

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase URL or service role key");
    process.exit(1);
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const user of SEED) {
    const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existing = listed?.users?.find(
      (u) => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    let userId = existing?.id;
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: user.name, role: user.role },
      });
      if (error) {
        console.error(`Create failed ${user.email}:`, error.message);
        continue;
      }
      userId = data.user.id;
      console.log(`Created auth user ${user.email}`);
    } else {
      console.log(`Auth user exists ${user.email}`);
    }

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone ?? null,
        status: "active",
        learner_id: user.learner_id ?? null,
        instructor_id: user.instructor_id ?? null,
        fee_track_id: user.fee_track_id ?? null,
        class_option_id: user.class_option_id ?? null,
        specialty: user.specialty ?? null,
      },
      { onConflict: "id" }
    );
    if (profileError) {
      console.error(`Profile upsert failed ${user.email}:`, profileError.message);
    } else {
      console.log(`Profile ready ${user.email} (${user.role})`);
    }
  }

  console.log("\nSeed complete. Demo password:", DEMO_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { NextResponse } from "next/server";
import {
  rukaGatewayFetch,
  transferPath,
  resolveRukaPayApiKey,
  resolveRukaPayEnvironment,
} from "@/lib/rukapay-server";
import { requireFinance } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const gated = await requireFinance();
    if (!gated.ok) return gated.response;

    const body = await request.json();
    const apiKey = resolveRukaPayApiKey();
    const environment = resolveRukaPayEnvironment(body.environment);

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "RukaPay is not configured on the server (RUKAPAY_API_KEY).",
          error: "UNAUTHORIZED",
        },
        { status: 401 }
      );
    }

    const phoneNumber = String(body.phoneNumber ?? "")
      .replace(/[\s\-()+ ]/g, "")
      .replace(/^\+/, "");
    const callbackUrl = body.callbackUrl;
    const partnerReference = String(body.partnerReference ?? "").trim();
    const amount = Number(body.amount) || 0;
    const learnerName = String(body.learnerName ?? "").trim();
    const learnerEmail = String(body.learnerEmail ?? "")
      .trim()
      .toLowerCase();
    const feeTrackId = String(body.feeTrackId ?? "4-month").trim() || "4-month";
    const classOptionId =
      String(body.classOptionId ?? "weekday").trim() || "weekday";

    if (!phoneNumber || !amount || !body.mnoProvider || !partnerReference) {
      return NextResponse.json(
        {
          success: false,
          message: "amount, phoneNumber, mnoProvider, and partnerReference are required",
          error: "BAD_REQUEST",
        },
        { status: 400 }
      );
    }

    if (!callbackUrl) {
      return NextResponse.json(
        {
          success: false,
          message: "callbackUrl is mandatory for PARTNER_COLLECT_MNO",
          error: "BAD_REQUEST",
        },
        { status: 400 }
      );
    }

    // Store a pending ledger row so the webhook can settle without trusting the browser.
    if (learnerEmail.includes("@") && learnerName) {
      await gated.admin.from("payments").upsert(
        {
          id: `PAY-${partnerReference}`,
          learner_name: learnerName,
          learner_email: learnerEmail,
          phone: phoneNumber,
          fee_track_id: feeTrackId,
          class_option_id: classOptionId,
          amount,
          method: "mobile_money",
          reference: partnerReference,
          date: new Date().toISOString().slice(0, 10),
          status: "pending",
          credentials_sent: false,
        },
        { onConflict: "id" }
      );
    }

    const { ok, status, data } = await rukaGatewayFetch(
      apiKey,
      environment,
      transferPath(environment),
      {
        method: "POST",
        body: JSON.stringify({
          transactionMode: "PARTNER_COLLECT_MNO",
          amount,
          currency: "UGX",
          phoneNumber,
          mnoProvider: body.mnoProvider,
          narration: body.narration ?? "Dreyz Interior Design School — fee payment",
          partnerReference,
          callbackUrl,
        }),
      }
    );

    return NextResponse.json(data, { status: ok ? 200 : status });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: String(err), error: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

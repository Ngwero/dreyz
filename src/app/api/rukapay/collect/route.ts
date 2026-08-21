import { NextResponse } from "next/server";
import {
  rukaGatewayFetch,
  transferPath,
  type RukaPayEnvironment,
} from "@/lib/rukapay-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey ?? process.env.RUKAPAY_API_KEY;
    const environment = (body.environment ?? "development") as RukaPayEnvironment;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Missing API key", error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const phoneNumber = String(body.phoneNumber ?? "").replace(/[\s\-()+ ]/g, "").replace(/^\+/, "");
    const callbackUrl = body.callbackUrl;

    if (!phoneNumber || !body.amount || !body.mnoProvider || !body.partnerReference) {
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

    const { ok, status, data } = await rukaGatewayFetch(
      apiKey,
      environment,
      transferPath(environment),
      {
        method: "POST",
        body: JSON.stringify({
          transactionMode: "PARTNER_COLLECT_MNO",
          amount: Number(body.amount),
          currency: "UGX",
          phoneNumber,
          mnoProvider: body.mnoProvider,
          narration: body.narration ?? "Dreyz Interior Design School — fee payment",
          partnerReference: body.partnerReference,
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

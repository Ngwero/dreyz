import { NextResponse } from "next/server";
import {
  rukaGatewayFetch,
  validatePath,
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
    const phoneNumber = String(body.phoneNumber ?? "")
      .replace(/[\s\-()+ ]/g, "")
      .replace(/^\+/, "");
    const mnoProvider = body.mnoProvider as "MTN" | "AIRTEL";

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

    if (!phoneNumber || !mnoProvider) {
      return NextResponse.json(
        {
          success: false,
          message: "phoneNumber and mnoProvider are required",
          error: "BAD_REQUEST",
        },
        { status: 400 }
      );
    }

    const { ok, status, data } = await rukaGatewayFetch(
      apiKey,
      environment,
      validatePath(environment),
      {
        method: "POST",
        body: JSON.stringify({
          transactionMode: "PARTNER_SEND_MNO",
          phoneNumber,
          mnoProvider,
          reference: body.reference,
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

import { NextResponse } from "next/server";
import {
  rukaGatewayFetch,
  validatePath,
  type RukaPayEnvironment,
} from "@/lib/rukapay-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = body.apiKey ?? process.env.RUKAPAY_API_KEY;
    const environment = (body.environment ?? "development") as RukaPayEnvironment;
    const phoneNumber = String(body.phoneNumber ?? "").replace(/[\s\-()+ ]/g, "").replace(/^\+/, "");
    const mnoProvider = body.mnoProvider as "MTN" | "AIRTEL";

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Missing API key", error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (!phoneNumber || !mnoProvider) {
      return NextResponse.json(
        { success: false, message: "phoneNumber and mnoProvider are required", error: "BAD_REQUEST" },
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

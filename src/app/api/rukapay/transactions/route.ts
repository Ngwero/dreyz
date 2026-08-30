import { NextResponse } from "next/server";
import {
  rukaGatewayFetch,
  resolveRukaPayApiKey,
  resolveRukaPayEnvironment,
} from "@/lib/rukapay-server";
import { requireFinance } from "@/lib/api-auth";

export async function GET(request: Request) {
  try {
    const gated = await requireFinance();
    if (!gated.ok) return gated.response;

    const { searchParams } = new URL(request.url);
    const apiKey = resolveRukaPayApiKey();
    const environment = resolveRukaPayEnvironment(
      searchParams.get("environment")
    );

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          message: "RukaPay is not configured on the server (RUKAPAY_API_KEY).",
          transactions: [],
        },
        { status: 401 }
      );
    }

    const { ok, status, data } = await rukaGatewayFetch(
      apiKey,
      environment,
      "/transactions",
      { method: "GET" }
    );

    return NextResponse.json(data, { status: ok ? 200 : status });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: String(err), transactions: [] },
      { status: 500 }
    );
  }
}

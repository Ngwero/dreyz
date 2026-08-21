import { NextResponse } from "next/server";
import { rukaGatewayFetch, type RukaPayEnvironment } from "@/lib/rukapay-server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get("apiKey") ?? process.env.RUKAPAY_API_KEY;
    const environment = (searchParams.get("environment") ?? "development") as RukaPayEnvironment;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "Missing API key", transactions: [] },
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

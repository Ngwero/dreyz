import { NextResponse } from "next/server";

/**
 * RukaPay collection callback endpoint.
 * Required for PARTNER_COLLECT_MNO — RukaPay POSTs payment status here.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const partnerReference =
      body.partnerReference ?? body.merchant_reference ?? body.reference;
    const transactionId = body.transactionId ?? body.transaction_id ?? body.id;
    const status = body.status ?? body.transaction?.status;
    const event = body.event ?? body.type ?? "collection.callback";

    console.info("[RukaPay Webhook]", {
      event,
      partnerReference,
      transactionId,
      status,
      body,
    });

    return NextResponse.json({
      received: true,
      partnerReference,
      transactionId,
      status,
    });
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "rukapay-webhook",
    note: "POST collection callbacks from RukaPay PARTNER_COLLECT_MNO here",
  });
}

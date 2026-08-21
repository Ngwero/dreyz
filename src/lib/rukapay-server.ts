/**
 * Server-side RukaPay Gateway client.
 * Docs: https://dev.partners.rukapay.co.ug/dashboard/documentation
 */

export type RukaPayEnvironment = "development" | "production";

export function gatewayBaseUrl(environment: RukaPayEnvironment): string {
  return environment === "production"
    ? "https://api.rukapay.net/api/v1/gateway"
    : "https://dev-api.rukapay.net/api/v1/gateway";
}

/** Sandbox endpoints only work in the development environment. */
export function transferPath(environment: RukaPayEnvironment): string {
  return environment === "development"
    ? "/process-transfer-sandbox"
    : "/process-transfer";
}

export function validatePath(environment: RukaPayEnvironment): string {
  return environment === "development"
    ? "/validate-beneficiary-sandbox"
    : "/validate-beneficiary";
}

export async function rukaGatewayFetch(
  apiKey: string,
  environment: RukaPayEnvironment,
  path: string,
  init: RequestInit = {}
) {
  const res = await fetch(`${gatewayBaseUrl(environment)}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({
    success: false,
    message: "Invalid JSON response from RukaPay",
  }));

  return { ok: res.ok, status: res.status, data };
}

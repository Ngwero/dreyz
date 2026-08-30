/**
 * Server-side RukaPay helpers — API key never leaves the server.
 */

export type RukaPayEnvironment = "development" | "production";

export function resolveRukaPayApiKey(bodyKey?: unknown): string {
  const fromEnv = String(process.env.RUKAPAY_API_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  // Ignore any client-supplied key in production.
  if (process.env.NODE_ENV === "production") return "";
  // Dev-only fallback if someone still passes a key locally without env set.
  return String(bodyKey ?? "").trim();
}

export function resolveRukaPayEnvironment(bodyEnv?: unknown): RukaPayEnvironment {
  const fromEnv = String(process.env.RUKAPAY_ENVIRONMENT ?? "").trim();
  if (fromEnv === "production" || fromEnv === "development") return fromEnv;
  if (bodyEnv === "production" || bodyEnv === "development") return bodyEnv;
  return "development";
}

export function gatewayBaseUrl(environment: RukaPayEnvironment): string {
  return environment === "production"
    ? "https://api.rukapay.net/api/v1/gateway"
    : "https://dev-api.rukapay.net/api/v1/gateway";
}

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

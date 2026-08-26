/**
 * RukaPay Gateway API — client wrapper (sandbox + live).
 *
 * Documentation: https://dev.partners.rukapay.co.ug/dashboard/documentation
 * Sandbox uses dev-api.rukapay.net with -sandbox endpoints (no real money).
 *
 * All outbound calls go through Next.js API routes to avoid CORS and keep
 * the x-api-key header on the server side.
 */

export type RukaPayConfig = {
  apiKey: string;
  environment: "development" | "production";
  webhookUrl: string;
  enabled: boolean;
};

/** Sandbox test numbers from RukaPay docs — providers aligned to sandbox prefix rules. */
export const SANDBOX_TEST_NUMBERS = [
  { phone: "256770123456", provider: "MTN" as const, name: "John Doe" },
  { phone: "256780123456", provider: "MTN" as const, name: "Jane Smith" },
  { phone: "256700123456", provider: "AIRTEL" as const, name: "John Doe" },
  { phone: "256710123456", provider: "AIRTEL" as const, name: "Jane Smith" },
  { phone: "256740123456", provider: "AIRTEL" as const, name: "Jane Smith" },
  { phone: "256750123456", provider: "AIRTEL" as const, name: "Peter Okello" },
];

const RUKA_CONFIG_KEY = "dreyz_rukapay_config";

const DEFAULT_CONFIG: RukaPayConfig = {
  apiKey: "4Gb1NlaqAlGTOuwH31ImAD4GTG6m2gbeVHa4RF8Y18cY",
  environment: "development",
  webhookUrl: "",
  enabled: true,
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function getRukaPayConfig(): RukaPayConfig {
  if (!isBrowser()) return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(RUKA_CONFIG_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as RukaPayConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveRukaPayConfig(config: RukaPayConfig) {
  if (!isBrowser()) return;
  localStorage.setItem(RUKA_CONFIG_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: RUKA_CONFIG_KEY } }));
  void import("@/lib/store").then((mod) => mod.queueCloudPush());
}

export function isRukaPayReady(): boolean {
  const c = getRukaPayConfig();
  return c.enabled && !!c.apiKey;
}

export function isSandboxMode(): boolean {
  return getRukaPayConfig().environment === "development";
}

function configPayload() {
  const c = getRukaPayConfig();
  return { apiKey: c.apiKey, environment: c.environment };
}

function defaultCallbackUrl(): string {
  const c = getRukaPayConfig();
  if (c.webhookUrl) return c.webhookUrl;
  if (isBrowser()) return `${window.location.origin}/api/rukapay/webhook`;
  return "/api/rukapay/webhook";
}

// ─── Validate Beneficiary (Sandbox) ─────────────────────────────────

export type ValidateResult = {
  success: boolean;
  message: string;
  beneficiary?: {
    phoneNumber?: string;
    provider?: string;
    name?: string;
    isValid: boolean;
  };
  error?: string;
  statusCode?: number;
};

/**
 * POST /api/rukapay/validate → RukaPay validate-beneficiary-sandbox
 * Uses transactionMode: PARTNER_SEND_MNO per docs.
 */
export async function validateBeneficiary(
  phone: string,
  provider: "MTN" | "AIRTEL"
): Promise<ValidateResult> {
  const config = getRukaPayConfig();
  if (!config.enabled || !config.apiKey) {
    return { success: false, message: "RukaPay not configured." };
  }

  try {
    const res = await fetch("/api/rukapay/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...configPayload(),
        phoneNumber: normalizePhone(phone),
        mnoProvider: provider,
      }),
    });
    const data = (await res.json()) as ValidateResult;
    if (!res.ok && !data.message) {
      return { success: false, message: `Validation failed (${res.status})`, statusCode: res.status };
    }
    return data;
  } catch (err) {
    return { success: false, message: String(err) };
  }
}

// ─── Collect from MNO (Sandbox) ───────────────────────────────────────

export type CollectInput = {
  amount: number;
  phone: string;
  provider: "MTN" | "AIRTEL";
  narration?: string;
  partnerReference: string;
  callbackUrl?: string;
};

export type RukaTransaction = {
  transactionId: string;
  reference: string;
  amount: number;
  fee: number;
  totalCharged: number;
  status: "SUCCESS" | "PENDING" | "FAILED";
  sender?: {
    name: string;
    phoneNumber: string;
    provider: string;
  };
  recipient?: {
    name: string;
    account: string;
    provider: string;
  };
  createdAt: string;
};

export type CollectResponse = {
  success: boolean;
  message: string;
  transaction?: RukaTransaction;
  walletBalance?: {
    walletId: string;
    walletType: string;
    balanceBefore: number;
    balanceAfter: number;
    currency: string;
  };
  error?: string;
  statusCode?: number;
};

/**
 * POST /api/rukapay/collect → RukaPay process-transfer-sandbox
 * transactionMode: PARTNER_COLLECT_MNO (callbackUrl required)
 */
export async function collectFromMNO(input: CollectInput): Promise<CollectResponse> {
  const config = getRukaPayConfig();
  if (!config.enabled || !config.apiKey) {
    return {
      success: false,
      message: "RukaPay is not configured. Add your API key in Settings → RukaPay.",
    };
  }

  const callbackUrl = input.callbackUrl ?? defaultCallbackUrl();
  if (!callbackUrl) {
    return { success: false, message: "callbackUrl is mandatory for PARTNER_COLLECT_MNO" };
  }

  try {
    const res = await fetch("/api/rukapay/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...configPayload(),
        amount: input.amount,
        phoneNumber: normalizePhone(input.phone),
        mnoProvider: input.provider,
        narration: input.narration ?? "Dreyz Interior Design School — fee payment",
        partnerReference: input.partnerReference,
        callbackUrl,
      }),
    });
    const data = (await res.json()) as CollectResponse & { statusCode?: number; error?: string };
    if (!res.ok) {
      return {
        success: false,
        message: data.message ?? data.error ?? `Collection failed (${res.status})`,
        error: data.error,
        statusCode: res.status,
      };
    }
    return data;
  } catch (err) {
    return { success: false, message: `Network error: ${String(err)}` };
  }
}

// ─── Get Transactions ─────────────────────────────────────────────────

export type TransactionsResponse = {
  success: boolean;
  message: string;
  transactions: RukaTransaction[];
  pagination?: { page: number; limit: number; total: number };
  note?: string;
};

export async function getTransactions(): Promise<TransactionsResponse> {
  const config = getRukaPayConfig();
  if (!config.enabled || !config.apiKey) {
    return { success: false, message: "Not configured", transactions: [] };
  }

  try {
    const params = new URLSearchParams({
      apiKey: config.apiKey,
      environment: config.environment,
    });
    const res = await fetch(`/api/rukapay/transactions?${params}`);
    return (await res.json()) as TransactionsResponse;
  } catch (err) {
    return { success: false, message: String(err), transactions: [] };
  }
}

// ─── Local transaction tracking ───────────────────────────────────────

export type LocalTxn = {
  id: string;
  partnerReference: string;
  amount: number;
  phone: string;
  provider: string;
  customerName: string;
  status: "pending" | "success" | "failed";
  rukaTransactionId?: string;
  createdAt: string;
  completedAt?: string;
};

const TXN_KEY = "dreyz_rukapay_txns";

function readTxns(): LocalTxn[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(TXN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeTxns(txns: LocalTxn[]) {
  if (!isBrowser()) return;
  localStorage.setItem(TXN_KEY, JSON.stringify(txns));
  window.dispatchEvent(new CustomEvent("dreyz-store", { detail: { key: TXN_KEY } }));
}

export function saveLocalTxn(txn: LocalTxn) {
  const all = readTxns();
  all.unshift(txn);
  writeTxns(all);
}

export function updateLocalTxn(partnerRef: string, patch: Partial<LocalTxn>) {
  const all = readTxns();
  const i = all.findIndex((t) => t.partnerReference === partnerRef);
  if (i >= 0) {
    all[i] = { ...all[i], ...patch };
    writeTxns(all);
  }
}

export function getAllLocalTxns(): LocalTxn[] {
  return readTxns();
}

// ─── Helpers ─────────────────────────────────────────────────────────

export function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("0")) p = "256" + p.slice(1);
  return p;
}

export function detectProvider(phone: string): "MTN" | "AIRTEL" | null {
  const p = normalizePhone(phone);
  const digits = p.replace(/^256/, "");
  // MTN Uganda: 77, 78, 76, 39, 79
  if (/^(77|78|76|39|79)/.test(digits)) return "MTN";
  // Airtel Uganda: 70, 71, 74, 75, 20
  if (/^(70|71|74|75|20)/.test(digits)) return "AIRTEL";
  return null;
}

/** Resolve provider — prefer explicit sandbox test entry when matched. */
export function resolveProvider(phone: string): "MTN" | "AIRTEL" | null {
  const normalized = normalizePhone(phone);
  const sandboxMatch = SANDBOX_TEST_NUMBERS.find((t) => t.phone === normalized);
  if (sandboxMatch) return sandboxMatch.provider;
  return detectProvider(phone);
}

export function formatPhoneDisplay(phone: string): string {
  const p = normalizePhone(phone);
  return p.startsWith("256") ? `+${p}` : p;
}

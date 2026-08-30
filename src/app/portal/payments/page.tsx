"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  PageHeader,
  DataTable,
  TableRow,
  TableCell,
  Button,
} from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { feeTracks, classOptions } from "@/lib/data";
import { formatUGX } from "@/lib/utils";
import {
  confirmPaymentAndProvision,
  getEmailOutbox,
  getPayments,
} from "@/lib/auth";
import { provisionPortalAccount } from "@/lib/auth-client";
import { showFlash } from "@/lib/flash";
import type { CredentialEmail, PaymentRecord } from "@/lib/types";
import {
  Mail,
  CheckCircle2,
  Smartphone,
  Loader2,
  AlertCircle,
  Wifi,
  CreditCard,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PaymentLedger } from "@/components/payments/PaymentLedger";
import {
  isRukaPayReady,
  isSandboxMode,
  collectFromMNO,
  validateBeneficiary,
  resolveProvider,
  getAllLocalTxns,
  saveLocalTxn,
  updateLocalTxn,
  getRukaPayConfig,
  SANDBOX_TEST_NUMBERS,
  formatPhoneDisplay,
  type LocalTxn,
} from "@/lib/rukapay";

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/15";

export default function PaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>(() => getPayments());
  const [outbox, setOutbox] = useState(() => getEmailOutbox());
  const [lastEmail, setLastEmail] = useState<CredentialEmail | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rukaReady = useMemo(() => isRukaPayReady(), []);
  const sandbox = useMemo(() => isSandboxMode(), []);
  const canRecord =
    user?.role === "super_admin" || user?.role === "accountant";
  const [payMode, setPayMode] = useState<"manual" | "rukapay">(rukaReady ? "rukapay" : "manual");
  const [rukaPending, setRukaPending] = useState(false);
  const [rukaMsg, setRukaMsg] = useState("");
  const [rukaMsgType, setRukaMsgType] = useState<"info" | "success" | "error">("info");
  const [validated, setValidated] = useState(false);
  const [validatedName, setValidatedName] = useState("");
  const [rukaTransactions, setRukaTransactions] = useState<LocalTxn[]>(() => getAllLocalTxns());

  const [recordOpen, setRecordOpen] = useState(true);
  const [form, setForm] = useState({
    learnerName: "",
    learnerEmail: "",
    phone: "",
    feeTrackId: feeTracks[0]?.id ?? "4-month",
    classOptionId: classOptions[0]?.id ?? "weekday",
    method: "mobile_money" as PaymentRecord["method"],
    reference: "",
    amount: feeTracks[0]?.total ?? 3350000,
  });

  const selectedTrack = useMemo(
    () => feeTracks.find((t) => t.id === form.feeTrackId),
    [form.feeTrackId]
  );

  const provider = useMemo(() => resolveProvider(form.phone), [form.phone]);

  if (user && !canRecord) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted">
        Only Super Admin and Accountant can record payments.
      </div>
    );
  }

  const onTrackChange = (feeTrackId: string) => {
    const track = feeTracks.find((t) => t.id === feeTrackId);
    setForm((f) => ({ ...f, feeTrackId, amount: track?.total ?? f.amount }));
  };

  const resetForm = () => {
    setForm((f) => ({ ...f, learnerName: "", learnerEmail: "", phone: "", reference: "" }));
    setValidated(false);
    setValidatedName("");
  };

  // ── Manual confirm ──
  const onSubmitManual = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const amount = Number(form.amount) || selectedTrack?.total || 0;
      const live = await provisionPortalAccount({
        name: form.learnerName,
        email: form.learnerEmail,
        phone: form.phone,
        role: "student",
        feeTrackId: form.feeTrackId,
        classOptionId: form.classOptionId,
      });
      const result = confirmPaymentAndProvision({
        ...form,
        amount,
      });
      setPayments(getPayments());
      setOutbox(getEmailOutbox());
      setLastEmail(result.email);
      if (!live.ok) {
        const msg = `Payment saved, but the live login was not created: ${live.error} Open Learners and use Email live login.`;
        setRukaMsg(msg);
        setRukaMsgType("error");
        showFlash("error", msg);
      } else if (live.alreadyExists) {
        const msg = `Payment saved. Login emailed to ${form.learnerEmail}${live.password ? `. Temporary password: ${live.password}` : "."}`;
        setRukaMsg(msg);
        setRukaMsgType("success");
        showFlash("success", msg);
      } else {
        const msg = `Payment saved. Live login emailed to ${form.learnerEmail}. Temporary password: ${live.password ?? "—"}`;
        setRukaMsg(msg);
        setRukaMsgType("success");
        showFlash("success", msg);
      }
      resetForm();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Validate phone via RukaPay ──
  const onValidate = async () => {
    if (!provider) return;
    setRukaPending(true);
    setRukaMsg("");
    const res = await validateBeneficiary(form.phone, provider);
    if (res.success && res.beneficiary?.isValid) {
      setValidated(true);
      setValidatedName(res.beneficiary.name ?? "");
      const msg = `Validated: ${res.beneficiary.name ?? "Account found"} (${res.beneficiary.provider})`;
      setRukaMsg(msg);
      setRukaMsgType("success");
      showFlash("success", msg);
    } else {
      setValidated(false);
      const msg = res.message || res.error || "Validation failed.";
      setRukaMsg(msg);
      setRukaMsgType("error");
      showFlash("error", msg);
    }
    setRukaPending(false);
  };

  // ── Collect via RukaPay (PARTNER_COLLECT_MNO) ──
  const onSubmitRuka = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider) {
      setRukaMsg("Enter a valid MTN or Airtel Uganda number.");
      setRukaMsgType("error");
      showFlash("error", "Enter a valid MTN or Airtel Uganda number.");
      return;
    }

    setRukaPending(true);
    setRukaMsg("");

    const amount = Number(form.amount) || selectedTrack?.total || 0;
    const partnerRef = `DRZ-${Date.now().toString(36).toUpperCase()}`;
    const config = getRukaPayConfig();

    const callbackUrl = config.webhookUrl || `${window.location.origin}/api/rukapay/webhook`;

    saveLocalTxn({
      id: partnerRef,
      partnerReference: partnerRef,
      amount,
      phone: form.phone,
      provider,
      customerName: form.learnerName,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setRukaTransactions(getAllLocalTxns());

    const res = await collectFromMNO({
      amount,
      phone: form.phone,
      provider,
      narration: `Dreyz fees — ${selectedTrack?.name ?? form.feeTrackId}`,
      partnerReference: partnerRef,
      callbackUrl,
    });

    if (res.success && res.transaction) {
      updateLocalTxn(partnerRef, {
        status: res.transaction.status === "SUCCESS" ? "success" : "pending",
        rukaTransactionId: res.transaction.transactionId,
      });
      setRukaTransactions(getAllLocalTxns());

      if (res.transaction.status === "SUCCESS") {
        const live = await provisionPortalAccount({
          name: form.learnerName,
          email: form.learnerEmail,
          phone: form.phone,
          role: "student",
          feeTrackId: form.feeTrackId,
          classOptionId: form.classOptionId,
        });
        const result = confirmPaymentAndProvision({
          ...form,
          amount,
          reference: res.transaction.transactionId,
          method: "mobile_money",
        });
        setPayments(getPayments());
        setOutbox(getEmailOutbox());
        setLastEmail(result.email);
        setRukaMsg(
          live.ok
            ? live.alreadyExists
              ? `Payment collected. This student already has a live portal login. Txn: ${res.transaction.transactionId}`
              : `Payment collected. Live login emailed to ${form.learnerEmail}. Temporary password: ${live.password ?? "—"}. Txn: ${res.transaction.transactionId}`
            : `Payment collected, but live login failed: ${live.error}. Txn: ${res.transaction.transactionId}`
        );
        setRukaMsgType(live.ok ? "success" : "error");
        showFlash(
          live.ok ? "success" : "error",
          live.ok
            ? live.alreadyExists
              ? `Payment collected. Login emailed to ${form.learnerEmail}${live.password ? `. Temporary password: ${live.password}` : "."}`
              : `Payment collected. Live login emailed to ${form.learnerEmail}. Temporary password: ${live.password ?? "—"}`
            : `Payment collected, but live login failed: ${live.error}`
        );
        resetForm();
      } else {
        const pending = `Collection initiated (${res.transaction.status}). Txn: ${res.transaction.transactionId}. Waiting for callback confirmation.`;
        setRukaMsg(pending);
        setRukaMsgType("info");
        showFlash("success", pending);
      }
    } else {
      updateLocalTxn(partnerRef, { status: "failed" });
      setRukaTransactions(getAllLocalTxns());
      const failMsg = res.message || res.error || "Collection failed.";
      setRukaMsg(failMsg);
      setRukaMsgType("error");
      showFlash("error", failMsg);
    }

    setRukaPending(false);
  };

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Super Admin and Accountant can confirm manual payments (cash, bank, card, mobile money) or collect via RukaPay. Confirming creates the student account and emails their portal login."
      />

      <div className="mb-6">
        <button
          type="button"
          aria-expanded={recordOpen}
          onClick={() => setRecordOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 py-1 text-left"
        >
          <div>
            <p className="text-sm font-semibold text-foreground">Record a payment</p>
            <p className="mt-0.5 text-xs text-muted">
              Collect mobile money or confirm cash, bank, or card
            </p>
          </div>
          <ChevronDown
            size={18}
            className={`shrink-0 text-muted transition-transform ${recordOpen ? "rotate-180" : ""}`}
          />
        </button>

        {recordOpen && (
          <div className="mt-4">
            {rukaReady && sandbox && payMode === "rukapay" && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm">
                <p className="font-medium text-emerald-700 dark:text-emerald-300">
                  Sandbox mode — no real money processed
                </p>
                <p className="mt-1 text-xs text-muted">
                  Using <code className="text-[11px]">dev-api.rukapay.net</code> with sandbox endpoints.
                  Use the test numbers below to validate and collect.
                </p>
              </div>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-1">
              {rukaReady && (
                <button
                  type="button"
                  onClick={() => {
                    setPayMode("rukapay");
                    setRukaMsg("");
                  }}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    payMode === "rukapay"
                      ? "bg-accent text-white shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <Smartphone size={16} />
                  RukaPay (Mobile Money)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPayMode("manual");
                  setRukaMsg("");
                }}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  payMode === "manual"
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <CreditCard size={16} />
                Manual payment
              </button>
            </div>

            <p className="mb-3 text-sm font-medium text-foreground">
              {payMode === "rukapay" ? "Collect via RukaPay" : "Manual payment (cash, bank, card, or MoMo)"}
            </p>
          <form
            onSubmit={payMode === "rukapay" ? onSubmitRuka : onSubmitManual}
            className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
          >
            <Field label="Student full name">
              <input
                required
                value={form.learnerName}
                onChange={(e) => setForm({ ...form, learnerName: e.target.value })}
                className={fieldClass}
                placeholder="e.g. Amina Nalwoga"
              />
            </Field>
            <Field label="Student email (login)">
              <input
                required
                type="email"
                value={form.learnerEmail}
                onChange={(e) => setForm({ ...form, learnerEmail: e.target.value })}
                className={fieldClass}
                placeholder="student@email.com"
              />
            </Field>
            <Field label="Phone number" className="md:col-span-2 xl:col-span-1">
              <input
                required
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setValidated(false);
                  setValidatedName("");
                }}
                className={fieldClass}
                placeholder="+256 7XX XXXXXX"
              />
              {form.phone.length >= 10 && provider && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                    <Wifi size={12} /> {provider === "MTN" ? "MTN MoMo" : "Airtel Money"} detected
                  </p>
                  {payMode === "rukapay" && !validated && (
                    <button
                      type="button"
                      onClick={onValidate}
                      disabled={rukaPending}
                      className="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/20"
                    >
                      <UserCheck size={11} />
                      {rukaPending ? "Checking…" : "Validate"}
                    </button>
                  )}
                  {validated && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={11} /> {validatedName || "Valid"}
                    </span>
                  )}
                </div>
              )}
              {payMode === "rukapay" && sandbox && (
                <div className="mt-2 rounded-lg border border-border bg-surface/50 p-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Sandbox test numbers
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SANDBOX_TEST_NUMBERS.map((t) => (
                      <button
                        key={t.phone}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            phone: formatPhoneDisplay(t.phone),
                            learnerName: t.name,
                          }));
                          setValidated(false);
                          setValidatedName("");
                        }}
                        className="rounded-md border border-border px-2 py-1 text-[10px] text-muted hover:border-accent/40 hover:text-foreground"
                      >
                        {t.provider} {t.phone.slice(-6)} → {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Field>
            <Field label="Programme">
              <select
                value={form.feeTrackId}
                onChange={(e) => onTrackChange(e.target.value)}
                className={fieldClass}
              >
                {feeTracks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatUGX(t.total)}
                    {t.legacy ? " · previous rate" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Class option">
              <select
                value={form.classOptionId}
                onChange={(e) => setForm({ ...form, classOptionId: e.target.value })}
                className={fieldClass}
              >
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.days})
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3 md:col-span-2 xl:col-span-1">
              <Field label="Amount (UGX)">
                <input
                  required
                  type="number"
                  min={0}
                  value={form.amount}
                  onChange={(e) =>
                    setForm({ ...form, amount: Number(e.target.value) })
                  }
                  className={fieldClass}
                />
              </Field>
              <Field label="Method">
                <select
                  value={form.method}
                  onChange={(e) =>
                    setForm({ ...form, method: e.target.value as PaymentRecord["method"] })
                  }
                  className={fieldClass}
                >
                  <option value="mobile_money">Mobile money</option>
                  {payMode === "manual" && (
                    <>
                      <option value="bank">Bank transfer</option>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                    </>
                  )}
                </select>
              </Field>
            </div>

            {payMode === "manual" && (
              <Field label="Payment reference">
                <input
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  className={fieldClass}
                  placeholder="MM / bank ref (optional)"
                />
              </Field>
            )}

            {payMode === "rukapay" ? (
              <Button type="submit" disabled={rukaPending} className="w-full md:col-span-2 xl:col-span-3">
                {rukaPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={16} className="animate-spin" /> Collecting…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Smartphone size={16} /> Collect {formatUGX(Number(form.amount) || 0)} via {provider ?? "MoMo"}
                  </span>
                )}
              </Button>
            ) : (
              <Button type="submit" disabled={submitting} className="w-full md:col-span-2 xl:col-span-3">
                {submitting ? "Processing…" : "Confirm manual payment & email login"}
              </Button>
            )}

            {payMode === "rukapay" && (
              <p className="text-[11px] leading-relaxed text-muted md:col-span-2 xl:col-span-3">
                Calls RukaPay <code className="text-[10px]">PARTNER_COLLECT_MNO</code> to collect from the student&apos;s{" "}
                {provider === "MTN" ? "MTN MoMo" : provider === "AIRTEL" ? "Airtel Money" : "mobile money"} account.
                On success, the student portal account is created automatically.
              </p>
            )}
            {payMode === "manual" && (
              <p className="text-[11px] leading-relaxed text-muted md:col-span-2 xl:col-span-3">
                On confirm: student account is created (if new), a temporary password
                is generated, and login details are emailed to the student.
              </p>
            )}
          </form>

          {/* Status message */}
          {rukaMsg && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                rukaMsgType === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : rukaMsgType === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              {rukaMsgType === "success" ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : rukaMsgType === "error" ? (
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
              ) : (
                <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />
              )}
              <p>{rukaMsg}</p>
            </div>
          )}
          </div>
        )}
      </div>

      <div className="space-y-5">
          {lastEmail && (
            <Card title="Login email sent">
              <div className="mb-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={16} />
                Credentials emailed to {lastEmail.to}
              </div>
              <div className="rounded-lg border border-border bg-surface p-4 text-sm">
                <p className="mb-2 flex items-center gap-2 font-semibold">
                  <Mail size={14} /> {lastEmail.subject}
                </p>
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
                  {lastEmail.body}
                </pre>
              </div>
            </Card>
          )}

          {rukaTransactions.length > 0 && (
            <Card title="RukaPay transactions">
              <DataTable
                columns={[
                  { key: "ref", label: "Reference" },
                  { key: "phone", label: "Phone" },
                  { key: "amount", label: "Amount" },
                  { key: "provider", label: "Network" },
                  { key: "status", label: "Status" },
                ]}
              >
                {rukaTransactions.slice(0, 15).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-muted">
                      {t.partnerReference}
                      {t.rukaTransactionId && (
                        <p className="text-[10px]">{t.rukaTransactionId}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{t.phone}</TableCell>
                    <TableCell className="font-medium">{formatUGX(t.amount)}</TableCell>
                    <TableCell className="text-xs">
                      {t.provider === "MTN" ? "MTN MoMo" : t.provider === "AIRTEL" ? "Airtel" : t.provider}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "success" ? "success" : t.status === "failed" ? "danger" : "warning"
                        }
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            </Card>
          )}

          {canRecord ? (
            <PaymentLedger payments={payments} />
          ) : payments.length === 0 ? (
            <Card title="Payment history">
              <p className="text-sm text-muted">No payments recorded yet.</p>
            </Card>
          ) : (
            <Card title="Payment history">
              <DataTable
                columns={[
                  { key: "id", label: "ID" },
                  { key: "learner", label: "Student" },
                  { key: "amount", label: "Amount" },
                  { key: "date", label: "Date" },
                  { key: "status", label: "Status" },
                ]}
              >
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs text-muted">{p.id}</TableCell>
                    <TableCell>
                      <p className="font-medium">{p.learnerName}</p>
                      <p className="text-xs text-muted">{p.learnerEmail}</p>
                    </TableCell>
                    <TableCell className="font-medium">{formatUGX(p.amount)}</TableCell>
                    <TableCell className="text-muted">{p.date}</TableCell>
                    <TableCell>
                      <Badge variant={p.credentialsSent ? "success" : "warning"}>
                        {p.credentialsSent ? "Login emailed" : p.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </DataTable>
            </Card>
          )}

          <Card title="Credential email outbox">
            {outbox.length === 0 ? (
              <p className="text-sm text-muted">No emails sent yet.</p>
            ) : (
              <ul className="space-y-2">
                {outbox.slice(0, 8).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{m.to}</p>
                      <p className="text-xs text-muted">{m.subject}</p>
                    </div>
                    <span className="text-xs text-muted">
                      {new Date(m.sentAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

      {!rukaReady && (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <Smartphone size={16} />
            Enable mobile money collections with RukaPay
          </p>
          <p className="mt-1 text-xs text-muted">
            Go to <strong>Settings → RukaPay</strong> to add your API key from the{" "}
            <a
              href="https://dev.partners.rukapay.co.ug/dashboard/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              RukaPay partner dashboard
            </a>{" "}
            and start collecting fees via MTN MoMo &amp; Airtel Money.
          </p>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-xs font-semibold uppercase tracking-wider text-muted ${className ?? ""}`}>
      {label}
      {children}
    </label>
  );
}

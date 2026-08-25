"use client";

import { useMemo, useState } from "react";
import {
  DataTable,
  TableRow,
  TableCell,
  SearchInput,
  Button,
} from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { classOptions, feeTracks } from "@/lib/data";
import { formatUGX } from "@/lib/utils";
import { feesForStudent } from "@/lib/academics";
import { learnersStore } from "@/lib/store";
import type { PaymentRecord } from "@/lib/types";
import { Wallet, Clock, CircleAlert, Users } from "lucide-react";

type PeriodPreset = "all" | "today" | "week" | "month" | "quarter" | "year" | "custom";
type StatusFilter = "all" | "confirmed" | "pending" | "failed";
type AmountBand = "all" | "lt350" | "mid" | "gte1m";

function localISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeek(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - offset);
  return localISO(dt);
}

function periodRange(preset: PeriodPreset, from: string, to: string) {
  const today = localISO();
  if (preset === "all") return { from: "", to: "" };
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") return { from: startOfWeek(today), to: today };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "quarter") {
    const month = Number(today.slice(5, 7));
    const qStart = Math.floor((month - 1) / 3) * 3 + 1;
    return { from: `${today.slice(0, 4)}-${String(qStart).padStart(2, "0")}-01`, to: today };
  }
  if (preset === "year") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return { from, to };
}

function inRange(date: string, from: string, to: string) {
  const day = date.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

const METHOD_LABEL: Record<PaymentRecord["method"], string> = {
  mobile_money: "Mobile money",
  bank: "Bank",
  cash: "Cash",
  card: "Card",
};

const selectClass =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent/40";

const PERIODS: { id: PeriodPreset; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
  { id: "custom", label: "Custom dates" },
];

export function PaymentLedger({ payments }: { payments: PaymentRecord[] }) {
  const [query, setQuery] = useState("");
  const [payer, setPayer] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [method, setMethod] = useState<"all" | PaymentRecord["method"]>("all");
  const [programme, setProgramme] = useState("all");
  const [period, setPeriod] = useState<PeriodPreset>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [band, setBand] = useState<AmountBand>("all");
  const [view, setView] = useState<"ledger" | "outstanding">("ledger");

  const payers = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of payments) {
      const email = p.learnerEmail.toLowerCase();
      if (!map.has(email)) map.set(email, p.learnerName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [payments]);

  const range = periodRange(period, from, to);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minAmount ? Number(minAmount) : null;
    const max = maxAmount ? Number(maxAmount) : null;
    return payments.filter((p) => {
      if (!inRange(p.date, range.from, range.to)) return false;
      if (status !== "all" && p.status !== status) return false;
      if (method !== "all" && p.method !== method) return false;
      if (programme !== "all" && p.feeTrackId !== programme) return false;
      if (payer !== "all" && p.learnerEmail.toLowerCase() !== payer) return false;
      if (q) {
        const blob = `${p.learnerName} ${p.learnerEmail} ${p.phone} ${p.reference} ${p.id}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (min !== null && !Number.isNaN(min) && p.amount < min) return false;
      if (max !== null && !Number.isNaN(max) && p.amount > max) return false;
      if (band === "lt350" && p.amount >= 350_000) return false;
      if (band === "mid" && (p.amount < 350_000 || p.amount >= 1_000_000)) return false;
      if (band === "gte1m" && p.amount < 1_000_000) return false;
      return true;
    });
  }, [payments, query, payer, status, method, programme, range.from, range.to, minAmount, maxAmount, band]);

  const stats = useMemo(() => {
    const confirmed = filtered.filter((p) => p.status === "confirmed");
    const pending = filtered.filter((p) => p.status === "pending");
    const failed = filtered.filter((p) => p.status === "failed");
    const paid = confirmed.reduce((s, p) => s + p.amount, 0);
    const pendingAmt = pending.reduce((s, p) => s + p.amount, 0);
    const people = new Set(confirmed.map((p) => p.learnerEmail.toLowerCase())).size;
    return {
      paid,
      pendingAmt,
      failedAmt: failed.reduce((s, p) => s + p.amount, 0),
      paidCount: confirmed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      people,
    };
  }, [filtered]);

  const outstanding = useMemo(() => {
    const q = query.trim().toLowerCase();
    return learnersStore
      .getAll()
      .map((learner) => {
        const snap = feesForStudent(learner.email, undefined, learner.paidAmount, learner.feeDue);
        return { learner, snap };
      })
      .filter(({ learner, snap }) => {
        if (snap.balance <= 0) return false;
        if (payer !== "all" && learner.email.toLowerCase() !== payer) return false;
        if (q) {
          const blob = `${learner.name} ${learner.email} ${learner.phone}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        const enroll = learner.enrollmentDate ?? "";
        if ((range.from || range.to) && (!enroll || !inRange(enroll, range.from, range.to))) {
          return false;
        }
        const min = minAmount ? Number(minAmount) : null;
        const max = maxAmount ? Number(maxAmount) : null;
        if (min !== null && !Number.isNaN(min) && snap.balance < min) return false;
        if (max !== null && !Number.isNaN(max) && snap.balance > max) return false;
        if (band === "lt350" && snap.balance >= 350_000) return false;
        if (band === "mid" && (snap.balance < 350_000 || snap.balance >= 1_000_000)) return false;
        if (band === "gte1m" && snap.balance < 1_000_000) return false;
        return true;
      })
      .sort((a, b) => b.snap.balance - a.snap.balance);
  }, [query, payer, range.from, range.to, minAmount, maxAmount, band, payments]);

  const outstandingTotal = outstanding.reduce((s, row) => s + row.snap.balance, 0);

  const clear = () => {
    setQuery("");
    setPayer("all");
    setStatus("all");
    setMethod("all");
    setProgramme("all");
    setPeriod("all");
    setFrom("");
    setTo("");
    setMinAmount("");
    setMaxAmount("");
    setBand("all");
  };

  const trackName = (id: string) => feeTracks.find((t) => t.id === id)?.name ?? id;
  const className = (id: string) => classOptions.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("ledger")}
          className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
            view === "ledger" ? "bg-[#082878] text-white" : "border border-border bg-card text-muted"
          }`}
        >
          Who paid
        </button>
        <button
          type="button"
          onClick={() => setView("outstanding")}
          className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
            view === "outstanding" ? "bg-[#082878] text-white" : "border border-border bg-card text-muted"
          }`}
        >
          What’s pending
        </button>
      </div>

      {view === "ledger" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Collected" value={formatUGX(stats.paid)} hint={`${stats.paidCount} payments`} icon={Wallet} tone="lime" />
          <StatCard label="Pending" value={formatUGX(stats.pendingAmt)} hint={`${stats.pendingCount} awaiting`} icon={Clock} tone="warm" />
          <StatCard label="Failed" value={formatUGX(stats.failedAmt)} hint={`${stats.failedCount} records`} icon={CircleAlert} />
          <StatCard label="People who paid" value={String(stats.people)} hint="Unique students in this filter" icon={Users} tone="accent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Balance still due" value={formatUGX(outstandingTotal)} hint={`${outstanding.length} learners`} icon={Clock} tone="warm" />
          <StatCard label="People owing" value={String(outstanding.length)} hint="After the filters above" icon={Users} />
        </div>
      )}

      <Card title="Filters">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                period === item.id ? "bg-[#082878] text-white" : "bg-surface text-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="mb-4 grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-muted">
              From
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${selectClass} mt-1`} />
            </label>
            <label className="text-xs font-medium text-muted">
              To
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${selectClass} mt-1`} />
            </label>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput
            placeholder="Search name, email, phone, reference…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={payer} onChange={(e) => setPayer(e.target.value)} className={selectClass}>
            <option value="all">Anyone</option>
            {payers.map(([email, name]) => (
              <option key={email} value={email}>
                {name} — {email}
              </option>
            ))}
          </select>
          {view === "ledger" && (
            <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className={selectClass}>
              <option value="all">All statuses</option>
              <option value="confirmed">Paid / confirmed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          )}
          {view === "ledger" && (
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "all" | PaymentRecord["method"])}
              className={selectClass}
            >
              <option value="all">All methods</option>
              <option value="mobile_money">Mobile money</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          )}
          {view === "ledger" && (
            <select value={programme} onChange={(e) => setProgramme(e.target.value)} className={selectClass}>
              <option value="all">All programmes</option>
              {feeTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <select value={band} onChange={(e) => setBand(e.target.value as AmountBand)} className={selectClass}>
            <option value="all">Any amount</option>
            <option value="lt350">Under UGX 350,000</option>
            <option value="mid">UGX 350,000 – 999,999</option>
            <option value="gte1m">UGX 1,000,000+</option>
          </select>
          <input
            type="number"
            min={0}
            placeholder="Min UGX"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            className={selectClass}
          />
          <input
            type="number"
            min={0}
            placeholder="Max UGX"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className={selectClass}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={clear}>
            Clear filters
          </Button>
        </div>
      </Card>

      {view === "ledger" ? (
        <Card title={`Payment history (${filtered.length})`}>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted">No payments match these filters.</p>
          ) : (
            <DataTable
              columns={[
                { key: "date", label: "Date" },
                { key: "learner", label: "Who paid" },
                { key: "amount", label: "How much" },
                { key: "method", label: "Method" },
                { key: "programme", label: "Programme" },
                { key: "status", label: "Status" },
              ]}
            >
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-muted">{p.date}</TableCell>
                  <TableCell>
                    <p className="font-medium">{p.learnerName}</p>
                    <p className="text-xs text-muted">{p.learnerEmail}</p>
                    {p.phone ? <p className="text-xs text-muted">{p.phone}</p> : null}
                  </TableCell>
                  <TableCell className="font-medium">{formatUGX(p.amount)}</TableCell>
                  <TableCell className="text-sm">{METHOD_LABEL[p.method]}</TableCell>
                  <TableCell className="text-sm">
                    <p>{trackName(p.feeTrackId)}</p>
                    <p className="text-xs text-muted">{className(p.classOptionId)}</p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        p.status === "confirmed" ? "success" : p.status === "failed" ? "danger" : "warning"
                      }
                    >
                      {p.status}
                    </Badge>
                    {p.credentialsSent ? (
                      <p className="mt-1 text-[10px] text-muted">Login emailed</p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
        </Card>
      ) : (
        <Card title={`Outstanding balances (${outstanding.length})`}>
          {outstanding.length === 0 ? (
            <p className="text-sm text-muted">Nobody matching these filters still owes a balance.</p>
          ) : (
            <DataTable
              columns={[
                { key: "learner", label: "Learner" },
                { key: "paid", label: "Paid" },
                { key: "due", label: "Programme fee" },
                { key: "balance", label: "Pending" },
                { key: "enrolled", label: "Enrolled" },
              ]}
            >
              {outstanding.map(({ learner, snap }) => (
                <TableRow key={learner.id}>
                  <TableCell>
                    <p className="font-medium">{learner.name}</p>
                    <p className="text-xs text-muted">{learner.email}</p>
                  </TableCell>
                  <TableCell>{formatUGX(snap.paid)}</TableCell>
                  <TableCell>{formatUGX(snap.total)}</TableCell>
                  <TableCell className="font-medium">{formatUGX(snap.balance)}</TableCell>
                  <TableCell className="text-muted">{learner.enrollmentDate || "—"}</TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
        </Card>
      )}
    </div>
  );
}

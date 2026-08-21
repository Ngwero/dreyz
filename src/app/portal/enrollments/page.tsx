"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  DataTable,
  TableRow,
  TableCell,
  SearchInput,
  Button,
} from "@/components/ui/PageElements";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { enrollments } from "@/lib/data";
import { formatUGX } from "@/lib/utils";
import { Download } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getPayments } from "@/lib/auth";
import { exportCsv } from "@/lib/store";
import Link from "next/link";

export default function EnrollmentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState(() =>
    typeof window !== "undefined" ? getPayments() : []
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setPayments(getPayments());
    refresh();
    window.addEventListener("dreyz-store", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("dreyz-store", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const merged = useMemo(
    () => [
      ...payments.map((p) => ({
        id: p.id,
        learnerName: p.learnerName,
        email: p.learnerEmail,
        course: p.feeTrackId,
        date: p.date,
        amount: p.amount,
        status: "paid" as const,
        credentialsSent: p.credentialsSent,
      })),
      ...enrollments.map((e) => ({
        id: e.id,
        learnerName: e.learnerName,
        email: e.learnerEmail ?? "",
        course: e.course,
        date: e.date,
        amount: e.amount,
        status: e.status,
        credentialsSent: e.credentialsSent ?? e.status === "paid",
      })),
    ],
    [payments]
  );

  const roleFiltered =
    user?.role === "student"
      ? merged.filter(
          (r) =>
            r.email.toLowerCase() === user.email.toLowerCase() ||
            r.learnerName.toLowerCase().includes(user.name.split(" ")[0].toLowerCase())
        )
      : merged;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleFiltered;
    return roleFiltered.filter(
      (r) =>
        r.learnerName.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
    );
  }, [roleFiltered, query]);

  const totalRevenue = rows
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + e.amount, 0);
  const pending = rows.filter((e) => e.status === "pending").length;

  const onExport = () => {
    exportCsv("enrollments.csv", [
      ["ID", "Learner", "Course", "Date", "Amount", "Status", "Login emailed"],
      ...rows.map((r) => [
        r.id,
        r.learnerName,
        r.course,
        r.date,
        String(r.amount),
        r.status,
        r.credentialsSent ? "yes" : "no",
      ]),
    ]);
  };

  return (
    <div>
      <PageHeader
        title={user?.role === "student" ? "Fees & billing" : "Enrollments & Billing"}
        description={
          user?.role === "student"
            ? "Your fee payments and enrollment status."
            : "Track course enrollments, payments, and revenue. Confirming a payment emails the student their login."
        }
        action={
          user?.role === "super_admin" || user?.role === "accountant" ? (
            <div className="flex gap-2">
              <Link href="/portal/payments">
                <Button size="sm">Record payment</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download size={14} /> Export
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download size={14} /> Export
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-muted">
            {user?.role === "student" ? "Amount paid" : "Recent revenue"}
          </p>
          <p className="mt-1 text-2xl font-bold">{formatUGX(totalRevenue)}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">
            {user?.role === "student" ? "Records" : "Total enrollments"}
          </p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Pending payments</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pending}</p>
        </Card>
      </div>

      {user?.role !== "student" && (
        <div className="mb-6">
          <SearchInput
            placeholder="Search enrollments..."
            className="max-w-md"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      <DataTable
        columns={[
          { key: "id", label: "ID" },
          { key: "learner", label: "Learner" },
          { key: "course", label: "Course / track" },
          { key: "date", label: "Date" },
          { key: "amount", label: "Amount" },
          { key: "status", label: "Status" },
          { key: "login", label: "Login email" },
        ]}
      >
        {rows.map((enrollment) => (
          <TableRow key={enrollment.id}>
            <TableCell className="font-mono text-xs text-muted">
              {enrollment.id}
            </TableCell>
            <TableCell className="font-medium">{enrollment.learnerName}</TableCell>
            <TableCell className="max-w-[200px] truncate">
              {enrollment.course}
            </TableCell>
            <TableCell className="text-muted">{enrollment.date}</TableCell>
            <TableCell className="font-medium">
              {formatUGX(enrollment.amount)}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  enrollment.status === "paid"
                    ? "success"
                    : enrollment.status === "pending"
                      ? "warning"
                      : "danger"
                }
              >
                {enrollment.status}
              </Badge>
            </TableCell>
            <TableCell>
              {enrollment.status === "paid" ? (
                <Badge variant={enrollment.credentialsSent ? "success" : "warning"}>
                  {enrollment.credentialsSent ? "Sent" : "Pending"}
                </Badge>
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </DataTable>

      {rows.length === 0 && (
        <p className="mt-4 text-sm text-muted">No billing records to show.</p>
      )}
    </div>
  );
}

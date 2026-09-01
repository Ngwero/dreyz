"use client";

import { useMemo, useState } from "react";
import {
  PageHeader,
  Button,
  DataTable,
  TableRow,
  TableCell,
} from "@/components/ui/PageElements";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  certificatesStore,
  learnersStore,
  useStoreList,
  uid,
} from "@/lib/store";
import { computeLearnerProgress } from "@/lib/academics";
import { schoolInfo } from "@/lib/data";
import { showFlash } from "@/lib/flash";
import { resolveLearnerIntake } from "@/lib/intakes";
import type { CertificateRecord, Learner } from "@/lib/types";

function printCertificate(cert: CertificateRecord) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=600");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>Certificate — ${cert.learnerName}</title>
    <style>
      body{font-family:Georgia,serif;padding:48px;color:#082878;text-align:center}
      h1{font-size:28px;margin:24px 0 8px}
      .box{border:3px solid #082878;padding:40px;border-radius:8px}
      .muted{color:#5b6f94;font-size:14px}
    </style></head><body>
    <div class="box">
      <p class="muted">${schoolInfo.name}</p>
      <h1>Certificate of Completion</h1>
      <p>This certifies that</p>
      <h2>${cert.learnerName}</h2>
      <p>has completed the programme</p>
      <p><strong>${cert.programme}</strong></p>
      <p class="muted">Progress ${cert.progressPercent}% · Issued ${cert.issuedAt.slice(0, 10)} · ${cert.id}</p>
      <p class="muted" style="margin-top:32px">${schoolInfo.tagline}</p>
    </div>
    <script>window.print()</script>
    </body></html>`);
  w.document.close();
}

export default function CertificatesPage() {
  const { user } = useAuth();
  const [learners] = useStoreList(learnersStore.getAll, learnersStore.key);
  const [certs, refresh] = useStoreList(
    certificatesStore.getAll,
    certificatesStore.key
  );

  const canIssue = user?.role === "super_admin" || user?.role === "accountant";

  const mine = useMemo(() => {
    if (user?.role === "student") {
      return certs.filter(
        (c) =>
          c.learnerId === user.learnerId ||
          c.email.toLowerCase() === user.email.toLowerCase()
      );
    }
    return [...certs].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }, [certs, user]);

  const ready = useMemo(() => {
    if (!canIssue) return [] as Learner[];
    const issued = new Set(certs.map((c) => c.learnerId));
    return learners.filter((l) => {
      if (issued.has(l.id)) return false;
      return computeLearnerProgress(l) >= 100 || l.status === "completed";
    });
  }, [learners, certs, canIssue]);

  const issue = (learner: Learner) => {
    if (!canIssue || !user) return;
    const percent = computeLearnerProgress(learner);
    const record: CertificateRecord = {
      id: uid("CRT"),
      learnerId: learner.id,
      learnerName: learner.name,
      email: learner.email,
      programme: learner.course,
      progressPercent: percent,
      issuedAt: new Date().toISOString(),
      issuedBy: user.email,
    };
    certificatesStore.upsert(record);
    if (learner.status !== "completed") {
      learnersStore.upsert({ ...learner, status: "completed", progress: percent });
    }
    refresh();
    showFlash("success", `Certificate issued for ${learner.name}.`);
    printCertificate(record);
  };

  const printTranscript = (learner: Learner) => {
    const percent = computeLearnerProgress(learner);
    const w = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Transcript — ${learner.name}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a}
        h1{color:#082878}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        td,th{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:13px}
      </style></head><body>
      <h1>${schoolInfo.name}</h1>
      <p>Academic transcript</p>
      <p><strong>${learner.name}</strong> · ${learner.id} · ${learner.email}</p>
      <p>Intake ${resolveLearnerIntake(learner)} · Programme ${learner.course}</p>
      <p>Progress ${percent}% · Status ${learner.status}</p>
      <table>
        <tr><th>Field</th><th>Value</th></tr>
        <tr><td>Enrollment date</td><td>${learner.enrollmentDate}</td></tr>
        <tr><td>Phone</td><td>${learner.phone}</td></tr>
        <tr><td>Fee due</td><td>${learner.feeDue ?? "—"}</td></tr>
        <tr><td>Paid</td><td>${learner.paidAmount ?? "—"}</td></tr>
      </table>
      <p style="margin-top:24px;font-size:12px;color:#64748b">Generated ${new Date().toISOString().slice(0, 10)} · Official certificate issued separately when progress is complete.</p>
      <script>window.print()</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <div>
      <PageHeader
        title="Certificates & transcripts"
        description="Issue completion certificates when progress reaches 100%, and print a simple transcript for any learner."
      />

      {user?.role === "student" && (
        <Card className="mb-8" title="Your certificates">
          {mine.length === 0 ? (
            <p className="text-sm text-muted">
              No certificate yet. Keep attending and completing assessments — staff will
              issue one when you finish.
            </p>
          ) : (
            <ul className="space-y-2">
              {mine.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{c.programme}</p>
                    <p className="text-xs text-muted">
                      Issued {c.issuedAt.slice(0, 10)} · {c.progressPercent}%
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => printCertificate(c)}>
                    Print
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {canIssue && (
        <Card className="mb-8" title="Ready to certify">
          {ready.length === 0 ? (
            <p className="text-sm text-muted">
              No learners at 100% progress without a certificate yet.
            </p>
          ) : (
            <DataTable
              columns={[
                { key: "name", label: "Learner" },
                { key: "progress", label: "Progress" },
                { key: "actions", label: "" },
              ]}
            >
              {ready.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted">{l.id}</p>
                  </TableCell>
                  <TableCell>{computeLearnerProgress(l)}%</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => printTranscript(l)}>
                        Transcript
                      </Button>
                      <Button size="sm" onClick={() => issue(l)}>
                        Issue certificate
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </DataTable>
          )}
        </Card>
      )}

      {canIssue && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Issued certificates</h2>
          <DataTable
            columns={[
              { key: "learner", label: "Learner" },
              { key: "programme", label: "Programme" },
              { key: "date", label: "Issued" },
              { key: "actions", label: "" },
            ]}
          >
            {mine.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <p className="font-medium">{c.learnerName}</p>
                  <p className="text-xs text-muted">{c.learnerId}</p>
                </TableCell>
                <TableCell>{c.programme}</TableCell>
                <TableCell className="text-muted">{c.issuedAt.slice(0, 10)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Badge variant="success">{c.progressPercent}%</Badge>
                    <Button size="sm" variant="outline" onClick={() => printCertificate(c)}>
                      Print
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
          {canIssue && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Print transcript for any learner</p>
              <div className="flex flex-wrap gap-2">
                {learners.slice(0, 40).map((l) => (
                  <Button
                    key={l.id}
                    size="sm"
                    variant="outline"
                    onClick={() => printTranscript(l)}
                  >
                    {l.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

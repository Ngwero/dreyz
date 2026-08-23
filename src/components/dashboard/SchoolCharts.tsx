"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid color-mix(in srgb, var(--border) 80%, transparent)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
  boxShadow: "0 12px 32px rgba(8, 40, 120, 0.12)",
};

const NAVY = "#082878";
const BLUE = "#1b7eef";
const LIME = "#d8ff59";
const AMBER = "#ff8c00";
const SLATE = "#1F429A";

export function monthlyCollections(
  payments: { date: string; amount: number; status: string }[]
) {
  const now = new Date();
  const rows: { label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-GB", { month: "short" });
    const amount = payments
      .filter((p) => p.status === "confirmed" && p.date.slice(0, 7) === key)
      .reduce((s, p) => s + p.amount, 0);
    rows.push({ label, amount });
  }
  return rows;
}

export function RevenueAreaChart({
  data,
}: {
  data: { label: string; amount: number }[];
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="feeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} stopOpacity={0.45} />
              <stop offset="100%" stopColor={NAVY} stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="feeStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={NAVY} />
              <stop offset="100%" stopColor={BLUE} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [
              `UGX ${Number(value ?? 0).toLocaleString()}`,
              "Collected",
            ]}
          />
          <Area
            type="monotone"
            dataKey="amount"
            stroke="url(#feeStroke)"
            strokeWidth={2.5}
            fill="url(#feeFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AttendancePulseChart({
  present,
  late,
  absent,
}: {
  present: number;
  late: number;
  absent: number;
}) {
  const slices = [
    { name: "Present", value: present, color: NAVY },
    { name: "Late", value: late, color: AMBER },
    { name: "Absent", value: absent, color: "#c45c5c" },
  ].filter((s) => s.value > 0);
  const total = present + late + absent;
  const cx = 100;
  const cy = 100;
  const innerR = 58;
  const outerR = 82;
  const gap = slices.length > 1 ? 4 : 0;

  const point = (r: number, angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)] as const;
  };

  const donutPath = (start: number, end: number) => {
    const sweep = Math.max(end - start, 0.01);
    const large = sweep > 180 ? 1 : 0;
    const [ox1, oy1] = point(outerR, start);
    const [ox2, oy2] = point(outerR, end);
    const [ix2, iy2] = point(innerR, end);
    const [ix1, iy1] = point(innerR, start);
    return `M ${ox1} ${oy1} A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`;
  };

  const paths: { name: string; color: string; d: string }[] = [];
  if (total > 0 && slices.length) {
    let cursor = 0;
    for (const slice of slices) {
      const sweep = (slice.value / total) * 360;
      const start = cursor + gap / 2;
      const end = cursor + sweep - gap / 2;
      if (end > start) {
        paths.push({ name: slice.name, color: slice.color, d: donutPath(start, end) });
      }
      cursor += sweep;
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative mx-auto h-[200px] w-[200px]">
        <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
          {paths.length ? (
            paths.map((p) => <path key={p.name} d={p.d} fill={p.color} />)
          ) : (
            <path d={donutPath(0, 359.9)} fill="#d6dce8" />
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
            Marks
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{total}</p>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {[
          { name: "Present", color: NAVY, value: present },
          { name: "Late", color: AMBER, value: late },
          { name: "Absent", color: "#c45c5c", value: absent },
        ].map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[11px] text-muted">
              {item.name} {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GradientBarChart({
  data,
  valueLabel = "Count",
}: {
  data: { name: string; value: number; color?: string }[];
  valueLabel?: string;
}) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="barNavy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BLUE} />
              <stop offset="100%" stopColor={NAVY} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            interval={0}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), valueLabel]}
          />
          <Bar dataKey="value" radius={[10, 10, 4, 4]} maxBarSize={42} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={entry.color ?? (i % 2 === 0 ? "url(#barNavy)" : SLATE)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PeoplePortalChart({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <div className="w-full">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            Total people
          </p>
          <p className="mt-1 text-4xl font-semibold tracking-tight text-foreground">
            {data.reduce((s, r) => s + r.value, 0)}
          </p>
        </div>
        <p className="pb-1 text-xs text-muted">Live portal accounts</p>
      </div>

      <div className="flex h-3.5 overflow-hidden rounded-full bg-surface ring-1 ring-border/60">
        {data.map((row) => (
          <div
            key={row.name}
            className="h-full transition-[width]"
            style={{
              width: `${(row.value / total) * 100}%`,
              backgroundColor: row.color,
              minWidth: row.value > 0 ? 6 : 0,
            }}
            title={`${row.name}: ${row.value}`}
          />
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.map((row) => {
          const pct = Math.round((row.value / total) * 100);
          return (
            <div
              key={row.name}
              className="rounded-2xl border border-border/70 bg-gradient-to-br from-surface/90 to-transparent p-3.5"
            >
              <div
                className="mb-3 h-1.5 w-8 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <p className="text-2xl font-semibold tabular-nums text-foreground">{row.value}</p>
              <p className="mt-0.5 text-xs font-medium text-foreground">{row.name}</p>
              <p className="mt-1 text-[11px] text-muted">{pct}% of portal</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProgressRadarChart({
  classes,
  tests,
  exams,
  final,
}: {
  classes: number;
  tests: number;
  exams: number;
  final: number;
}) {
  const axes = [
    { label: "Classes", value: Math.max(0, Math.min(100, classes)) },
    { label: "Tests", value: Math.max(0, Math.min(100, tests)) },
    { label: "Exams", value: Math.max(0, Math.min(100, exams)) },
    { label: "Final", value: Math.max(0, Math.min(100, final)) },
  ];
  const cx = 110;
  const cy = 108;
  const maxR = 68;
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 2;
  const pt = (i: number, t: number) => {
    const a = angle(i);
    return [cx + Math.cos(a) * maxR * t, cy + Math.sin(a) * maxR * t] as const;
  };
  const ring = (t: number) => axes.map((_, i) => pt(i, t).join(",")).join(" ");
  const shape = axes.map((ax, i) => pt(i, ax.value / 100).join(",")).join(" ");

  return (
    <div className="w-full">
      <svg viewBox="0 0 220 228" className="mx-auto h-[228px] w-full max-w-[280px]" role="img" aria-label="Learner completion">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <polygon
            key={t}
            points={ring(t)}
            fill="none"
            stroke="color-mix(in srgb, var(--border) 85%, transparent)"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="color-mix(in srgb, var(--border) 85%, transparent)" />;
        })}
        <polygon points={shape} fill={LIME} fillOpacity="0.32" stroke={BLUE} strokeWidth="2.25" strokeLinejoin="round" />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, 1.28);
          return (
            <text
              key={ax.label}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--muted)"
              fontSize="11"
              fontWeight="600"
            >
              {ax.label} {Math.round(ax.value)}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}

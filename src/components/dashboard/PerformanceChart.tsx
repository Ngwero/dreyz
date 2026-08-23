"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PerformanceChartProps {
  data: { level: string; score: number }[];
}

const colors = ["#1b7eef", "#082878", "#c8f24a"];

export function PerformanceChart({ data }: PerformanceChartProps) {
  const rows = data.map((d) => ({
    level: d.level,
    score: d.score,
    bar: Math.max(d.score, 2),
  }));

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          layout="vertical"
          data={rows}
          margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis
            type="category"
            dataKey="level"
            width={96}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(_value, _name, item) => [
              `${item?.payload?.score ?? 0}%`,
              "Average",
            ]}
          />
          <Bar dataKey="bar" radius={[0, 10, 10, 0]} barSize={16} animationDuration={560}>
            {rows.map((entry, i) => (
              <Cell key={entry.level} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

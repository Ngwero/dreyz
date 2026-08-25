"use client";

import { PieChart, Pie, Cell } from "recharts";

interface CourseDonutChartProps {
  data: { name: string; value: number; color: string }[];
  total: number | string;
  centerLabel?: string;
  centerHint?: string;
}

export function CourseDonutChart({
  data,
  total,
  centerLabel = "Total",
  centerHint = "Units",
}: CourseDonutChartProps) {
  return (
    <div className="relative w-full">
      <div className="relative mx-auto h-[220px] w-[220px]">
          <PieChart width={220} height={220}>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </Pie>
          </PieChart>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            {centerLabel}
          </p>
          <p className="text-2xl font-semibold tabular-nums text-foreground">{total}</p>
          <p className="text-xs text-muted">{centerHint}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] text-muted">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

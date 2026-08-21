"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface CourseDonutChartProps {
  data: { name: string; value: number; color: string }[];
  total: number;
}

export function CourseDonutChart({ data, total }: CourseDonutChartProps) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={90}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Total
        </p>
        <p className="text-2xl font-semibold tabular-nums text-foreground">{total}</p>
        <p className="text-xs text-muted">Units</p>
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

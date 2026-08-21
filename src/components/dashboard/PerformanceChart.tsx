"use client";

interface PerformanceChartProps {
  data: { level: string; score: number }[];
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  const maxScore = 100;

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.level}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">{item.level}</span>
            <span className="tabular-nums font-semibold text-accent-dark">
              {item.score}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-navy transition-all"
              style={{ width: `${(item.score / maxScore) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

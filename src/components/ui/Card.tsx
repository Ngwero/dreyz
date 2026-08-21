import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ title, action, children, className, noPadding }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 pb-0 pt-5">
          {title && (
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className={cn(!noPadding && "p-5", title && !noPadding && "pt-4")}>
        {children}
      </div>
    </div>
  );
}

import { DISPLAY_IMPACT_META, LEGEND_ORDER } from "@/lib/impact-meta";
import { cn } from "@/lib/utils";

export interface ImpactLegendProps {
  className?: string;
}

export default function ImpactLegend({ className }: ImpactLegendProps) {
  return (
    <section
      aria-labelledby="impact-legend-heading"
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4",
        className,
      )}
    >
      <h2
        id="impact-legend-heading"
        className="text-sm font-semibold text-[var(--text-primary)]"
      >
        What the impact levels mean
      </h2>

      <dl className="mt-3 space-y-3">
        {LEGEND_ORDER.map((level) => {
          const meta = DISPLAY_IMPACT_META[level];
          const Icon = meta.icon;

          return (
            <div key={level} className="flex items-start gap-2.5">
              <Icon
                aria-hidden="true"
                className="mt-[2px] h-4 w-4 shrink-0"
                style={{ color: `var(${meta.cssVar})` }}
              />
              <div className="min-w-0">
                <dt
                  className="text-xs font-medium leading-tight"
                  style={{ color: `var(${meta.cssVar})` }}
                >
                  {meta.label}
                </dt>
                <dd className="mt-0.5 text-xs leading-relaxed text-[var(--text-muted)]">
                  {meta.description}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

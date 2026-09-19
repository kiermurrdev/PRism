"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Cloud,
  Cog,
  Database,
  Monitor,
  Server,
  X,
  type LucideIcon,
} from "lucide-react";

import { IMPACT_META } from "@/lib/impact-meta";
import { cn } from "@/lib/utils";
import type { ReportNode } from "@/types/report";

export interface NodeDetailsPanelProps {
  node: ReportNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type NodeKind = ReportNode["kind"];

const KIND_ICON: Record<NodeKind, LucideIcon> = {
  frontend: Monitor,
  backend: Server,
  database: Database,
  service: Cog,
  external: Cloud,
};

const KIND_LABEL: Record<NodeKind, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  service: "Service",
  external: "External",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Never fires. `mounted` only has to flip once, at hydration. */
const subscribeNever = () => () => {};

export default function NodeDetailsPanel({
  node,
  open,
  onOpenChange,
}: NodeDetailsPanelProps) {
  // With no selected node there is nothing to describe, so the panel stays shut
  // regardless of what `open` says.
  const isOpen = open && node !== null;

  // False on the server, true on the client, so `createPortal` never runs
  // during SSR. No state, so no setState inside an effect.
  const mounted = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Move focus into the panel, lock background scroll, and put focus back where
  // it came from on close.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Deferred by a frame on purpose. The panel can open from an Enter keydown
    // on a graph node; focusing the close button synchronously drops it under
    // that same keystroke, whose activation then closes the panel instantly.
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  // Escape closes from anywhere, including after an overlay click moved focus.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  // Keep Tab inside the panel while it is open.
  const trapFocus = useCallback((event: ReactKeyboardEvent) => {
    if (event.key !== "Tab") return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  if (!mounted || !isOpen || node === null) return null;

  const meta = IMPACT_META[node.impact];
  const KindIcon = KIND_ICON[node.kind];
  const ImpactIcon = meta.icon;
  const accent = `var(${meta.cssVar})`;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={close}
        className="absolute inset-0"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--background) 80%, transparent)",
        }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="node-details-title"
        onKeyDown={trapFocus}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-xl border border-[var(--border)] bg-[var(--surface)]",
          "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-xl",
        )}
      >
        <header className="flex items-start gap-3 border-b border-[var(--border)] p-4">
          <KindIcon
            aria-hidden="true"
            className="mt-[3px] h-5 w-5 shrink-0 text-[var(--text-muted)]"
          />
          <div className="min-w-0 flex-1">
            <h2
              id="node-details-title"
              className="text-base font-semibold leading-snug text-[var(--text-primary)]"
            >
              {node.label}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {KIND_LABEL[node.kind]}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close details"
            className="shrink-0 rounded-lg border border-[var(--border)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-cyan)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{ borderColor: accent, color: accent }}
          >
            <ImpactIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{meta.label}</span>
          </div>

          <section>
            <h3 className="text-xs font-medium text-[var(--text-muted)]">
              What this component does
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-primary)]">
              {node.description}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-medium text-[var(--text-muted)]">
              Why it may be affected
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-primary)]">
              {node.reason}
            </p>
          </section>

          <section>
            <h3 className="text-xs font-medium text-[var(--text-muted)]">
              Related files
            </h3>
            {node.filePaths.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {node.filePaths.map((path) => (
                  <li
                    key={path}
                    className="break-all rounded-md bg-[var(--surface-elevated)] px-2.5 py-1.5 font-mono text-xs leading-relaxed text-[var(--text-primary)]"
                  >
                    {path}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                No files associated with this component.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

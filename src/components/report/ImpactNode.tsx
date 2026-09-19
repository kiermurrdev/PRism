"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Cloud,
  Cog,
  Database,
  Monitor,
  Server,
  type LucideIcon,
} from "lucide-react";

import { IMPACT_META } from "@/lib/impact-meta";
import { cn } from "@/lib/utils";
import type { ImpactLevel, ReportNode } from "@/types/report";

type NodeKind = ReportNode["kind"];

/** Data carried by an `impactNode`. Mapped from `ReportNode` by ImpactGraph. */
export type ImpactNodeData = {
  label: string;
  kind: NodeKind;
  impact: ImpactLevel;
  description: string;
};

export type ImpactFlowNode = Node<ImpactNodeData, "impactNode">;

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

function ImpactNode({ data, selected }: NodeProps<ImpactFlowNode>) {
  const meta = IMPACT_META[data.impact];
  const KindIcon = KIND_ICON[data.kind];
  const ImpactIcon = meta.icon;
  const accent = `var(${meta.cssVar})`;

  return (
    <div
      className={cn(
        "w-[196px] rounded-xl border bg-[var(--surface-elevated)] px-3 py-2.5",
        selected &&
          "ring-2 ring-[var(--accent-cyan)] ring-offset-2 ring-offset-[var(--background)]",
      )}
      style={{ borderColor: accent }}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-[var(--border)]"
      />

      <div className="flex items-start gap-2">
        <KindIcon
          aria-hidden="true"
          className="mt-[3px] h-4 w-4 shrink-0 text-[var(--text-muted)]"
        />
        <span className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
          {data.label}
        </span>
      </div>

      <p className="mt-1 pl-6 text-[11px] leading-tight text-[var(--text-muted)]">
        {KIND_LABEL[data.kind]}
      </p>

      <div
        className="mt-2.5 flex items-center gap-1.5 border-t pt-2"
        style={{ borderColor: "var(--border)", color: accent }}
      >
        <ImpactIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[11px] font-medium leading-none">
          {meta.label}
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-1.5 !w-1.5 !border-0 !bg-[var(--border)]"
      />
    </div>
  );
}

export default memo(ImpactNode);

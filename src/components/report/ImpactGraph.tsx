"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import { ShieldCheck, Workflow } from "lucide-react";

import ImpactNode, {
  type ImpactFlowNode,
} from "@/components/report/ImpactNode";
import styles from "@/components/report/ImpactGraph.module.css";
import { IMPACT_META } from "@/lib/impact-meta";
import { cn } from "@/lib/utils";
import type { ReportEdge, ReportNode } from "@/types/report";

export interface ImpactGraphProps {
  nodes: ReportNode[];
  edges: ReportEdge[];
  /** Selection is owned by the parent. The graph holds no selection state. */
  selectedNodeId?: string;
  onNodeSelect: (node: ReportNode) => void;
  /** Additive, optional. Lets the report page place the canvas in its grid. */
  className?: string;
}

const nodeTypes: NodeTypes = { impactNode: ImpactNode };

const fitViewOptions = { padding: 0.18, maxZoom: 1 };

export default function ImpactGraph({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  className,
}: ImpactGraphProps) {
  const nodesById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const flowNodes = useMemo<ImpactFlowNode[]>(
    () =>
      nodes.map((node) => ({
        id: node.id,
        type: "impactNode" as const,
        position: node.position,
        selected: node.id === selectedNodeId,
        ariaLabel: `${node.label}. ${IMPACT_META[node.impact].label}. ${node.description}`,
        data: {
          label: node.label,
          kind: node.kind,
          impact: node.impact,
          description: node.description,
        },
      })),
    [nodes, selectedNodeId],
  );

  const flowEdges = useMemo<Edge[]>(
    () =>
      edges.map((edge) => {
        const touchesSelection =
          selectedNodeId !== undefined &&
          (edge.source === selectedNodeId || edge.target === selectedNodeId);
        const stroke = touchesSelection
          ? "var(--accent-cyan)"
          : "var(--border)";

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          focusable: false,
          style: { stroke, strokeWidth: touchesSelection ? 2 : 1.5 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: stroke,
          },
        };
      }),
    [edges, selectedNodeId],
  );

  /** Routes both pointer clicks and keyboard selection to `onNodeSelect`. */
  const handleNodesChange = useCallback(
    (changes: NodeChange<ImpactFlowNode>[]) => {
      for (const change of changes) {
        if (change.type === "select" && change.selected) {
          const node = nodesById.get(change.id);
          if (node) onNodeSelect(node);
          return;
        }
      }
    },
    [nodesById, onNodeSelect],
  );

  const isSelfContained = useMemo(
    () => nodes.length > 0 && !nodes.some((node) => node.impact === "possible"),
    [nodes],
  );

  const canvasClasses = cn(
    styles.canvas,
    "relative h-[420px] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] md:h-[520px]",
    className,
  );

  if (nodes.length === 0) {
    return (
      <section aria-label="Impact graph" className={canvasClasses}>
        <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
          <Workflow
            aria-hidden="true"
            className="h-6 w-6 text-[var(--text-muted)]"
          />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No components mapped for this pull request
          </p>
          <p className="max-w-xs text-xs leading-relaxed text-[var(--text-muted)]">
            The analysis did not associate the changed files with any component
            in the repository.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Impact graph" className={canvasClasses}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.4}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        elementsSelectable
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--border)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {isSelfContained ? (
        <p className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs leading-snug text-[var(--text-muted)]">
          <ShieldCheck
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--accent-cyan)]"
          />
          This change appears self-contained. Nothing outside the diff was
          identified as possibly affected.
        </p>
      ) : null}
    </section>
  );
}

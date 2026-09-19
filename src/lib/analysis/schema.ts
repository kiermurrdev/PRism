import { z } from "zod";

/**
 * Zod schemas for the live analysis contract.
 *
 * These schemas validate the same structures defined in src/types/report.ts
 * and src/types/analysis.ts, providing runtime validation without duplicating
 * the TypeScript types.
 */

const ImpactLevelSchema = z.enum(["direct", "possible", "unchanged"]);
const FileStatusSchema = z.enum(["added", "modified", "deleted"]);
const NodeKindSchema = z.enum(["frontend", "backend", "database", "service", "external"]);
const SeveritySchema = z.enum(["high", "medium", "low"]);

export const ReportNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: NodeKindSchema,
  impact: ImpactLevelSchema,
  description: z.string(),
  reason: z.string(),
  filePaths: z.array(z.string()),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
});

export const ReportEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

export const ImpactFindingSchema = z.object({
  id: z.string(),
  severity: SeveritySchema,
  title: z.string(),
  description: z.string(),
  affectedNodes: z.array(z.string()),
});

export const QAItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  checked: z.boolean(),
});

export const AffectedFileSchema = z.object({
  path: z.string(),
  status: FileStatusSchema,
  additions: z.number(),
  deletions: z.number(),
  changeType: z.string(),
});

/**
 * Schema for the canonical ReportData structure.
 */
export const ReportDataSchema = z.object({
  title: z.string(),
  prUrl: z.string().url(),
  summary: z.string(),
  nodes: z.array(ReportNodeSchema),
  edges: z.array(ReportEdgeSchema),
  findings: z.array(ImpactFindingSchema),
  qaItems: z.array(QAItemSchema),
  affectedFiles: z.array(AffectedFileSchema),
});

/**
 * Schema for AnalysisMetadata.
 */
export const AnalysisMetadataSchema = z.object({
  source: z.enum(["mock", "live"]),
  analyzedAt: z.string(),
  headSha: z.string(),
});

/**
 * Schema for the full live analysis result: ReportData + metadata.
 */
export const AnalysisResultSchema = ReportDataSchema.extend({
  metadata: AnalysisMetadataSchema,
});

/**
 * Schema for an analysis request.
 */
export const AnalysisRequestSchema = z.object({
  repo: z.string(),
  prNumber: z.number().int().positive(),
});

/**
 * Schema for an intermediate analysis snapshot.
 */
export const AnalysisSnapshotSchema = z.object({
  status: z.enum(["fetching", "analyzing", "generating"]),
  message: z.string(),
});

/**
 * Schema for a safe error response.
 */
export const AnalysisErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/**
 * Infer types from the schemas for consumers that want schema-derived types.
 */
export type ZReportNode = z.infer<typeof ReportNodeSchema>;
export type ZReportEdge = z.infer<typeof ReportEdgeSchema>;
export type ZImpactFinding = z.infer<typeof ImpactFindingSchema>;
export type ZQAItem = z.infer<typeof QAItemSchema>;
export type ZAffectedFile = z.infer<typeof AffectedFileSchema>;
export type ZReportData = z.infer<typeof ReportDataSchema>;
export type ZAnalysisMetadata = z.infer<typeof AnalysisMetadataSchema>;
export type ZAnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type ZAnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type ZAnalysisSnapshot = z.infer<typeof AnalysisSnapshotSchema>;
export type ZAnalysisError = z.infer<typeof AnalysisErrorSchema>;

export type ImpactLevel = "direct" | "possible" | "unchanged";

export type FileStatus = "added" | "modified" | "deleted";

export interface ReportNode {
  id: string;
  label: string;
  kind: "frontend" | "backend" | "database" | "service" | "external";
  impact: ImpactLevel;
  description: string;
  reason: string;
  filePaths: string[];
  position: {
    x: number;
    y: number;
  };
}

export interface ReportEdge {
  id: string;
  source: string;
  target: string;
}

export interface ImpactFinding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedNodes: string[];
}

export interface QAItem {
  id: string;
  description: string;
  checked: boolean;
}

export interface AffectedFile {
  path: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  changeType: string;
}

export interface ReportData {
  title: string;
  prUrl: string;
  summary: string;
  nodes: ReportNode[];
  edges: ReportEdge[];
  findings: ImpactFinding[];
  qaItems: QAItem[];
  affectedFiles: AffectedFile[];
}

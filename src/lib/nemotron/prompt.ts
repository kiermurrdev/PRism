import type { NemotronContext } from "./types";

/**
 * Builds the system prompt for the Nemotron analysis request.
 *
 * Instructs the model to:
 * - Return strict JSON matching the shared ReportData schema.
 * - Distinguish possible impact from confirmed defects.
 * - Ground file paths and statistics in supplied context.
 * - Not invent PR metadata or changed-file statistics.
 */
export function buildSystemPrompt(): string {
  return `You are a senior software engineer specializing in architectural impact analysis.

Your job is to analyze a pull request and produce a structured JSON report that helps
engineering teams understand what the PR changes, what it affects, and what to test.

CRITICAL RULES:

1. Output ONLY valid JSON. No prose, no markdown fences, no explanation outside the JSON.
2. The JSON must strictly match the provided schema. Every field is required.
3. Use only file paths that appear in the supplied repository context or changed files list.
4. Do NOT invent PR metadata (title, URL, SHA, branch names, file counts). Use exactly what is provided.
5. Do NOT invent changed-file statistics (additions, deletions, status). Use exactly what is provided.
6. "Possible" impact means a hypothesis that requires verification — it is NOT a confirmed defect.
7. Every node, edge, and finding must be grounded in actual code changes or project structure you were given.
8. Use stable, unique identifiers for all nodes (kebab-case, no spaces). These IDs will be used by React Flow.`;
}

/**
 * Builds the user prompt containing the PR context and analysis request.
 */
export function buildUserPrompt(context: NemotronContext): string {
  const changedFilesSection = context.changedFiles
    .map((f) => {
      const lines = [
        `- path: ${f.path}`,
        `  status: ${f.status}`,
        `  additions: ${f.additions}`,
        `  deletions: ${f.deletions}`,
      ];
      if (f.patch) {
        const patchPreview = f.patch.length > 2000 ? f.patch.slice(0, 2000) + "\n[truncated]" : f.patch;
        lines.push(`  patch:\n${patchPreview.split("\n").map((l) => "    " + l).join("\n")}`);
      }
      return lines.join("\n");
    })
    .join("\n");

  const repoContextSection = context.repoContext
    ? `REPOSITORY CONTEXT:

${context.repoContext}`
    : "";

  return `Analyze the following pull request and return a JSON report.

PR METADATA (do not modify these values):
- repo: ${context.repo}
- prNumber: ${context.prNumber}
- title: ${context.title}
- prUrl: ${context.prUrl}
- headSha: ${context.headSha}
- baseBranch: ${context.baseBranch}
- headBranch: ${context.headBranch}

CHANGED FILES (use these exact paths and statistics in your report):

${changedFilesSection}

${repoContextSection}

REQUIRED OUTPUT FORMAT:

Return a JSON object with these exact fields:

{
  "title": "<use the PR title exactly as provided>",
  "prUrl": "<use the prUrl exactly as provided>",
  "summary": "<concise architectural summary of the PR in 2-4 sentences>",
  "nodes": [
    {
      "id": "<stable kebab-case identifier>",
      "label": "<human-readable component name>",
      "kind": "<frontend|backend|database|service|external>",
      "impact": "<direct|possible|unchanged>",
      "description": "<what this component does>",
      "reason": "<why it is affected at this level>",
      "filePaths": ["<only files from the changed files list or repo context>"],
      "position": { "x": <number>, "y": <number> }
    }
  ],
  "edges": [
    {
      "id": "<stable kebab-case identifier>",
      "source": "<node id>",
      "target": "<node id>"
    }
  ],
  "findings": [
    {
      "id": "<stable kebab-case identifier>",
      "severity": "<high|medium|low>",
      "title": "<short finding title>",
      "description": "<explain the finding; mark possible impacts as hypotheses>",
      "affectedNodes": ["<node ids>"]
    }
  ],
  "qaItems": [
    {
      "id": "<stable kebab-case identifier>",
      "description": "<practical test or verification step>",
      "checked": false
    }
  ],
  "affectedFiles": [
    {
      "path": "<exact path from changed files list>",
      "status": "<added|modified|deleted>",
      "additions": <exact number from changed files list>,
      "deletions": <exact number from changed files list>,
      "changeType": "<brief description of what changed>"
    }
  ]
}

INSTRUCTIONS:

- Include ALL changed files in the "affectedFiles" array with their exact statistics.
- Create nodes for each major component or subsystem touched by this PR.
- Connect nodes with edges to show architectural relationships.
- Mark impact levels honestly:
  - "direct": the component is explicitly modified by this PR
  - "possible": the component may be affected based on architecture; this is a hypothesis
  - "unchanged": the component is part of the system but not affected
- Provide 3-8 practical QA checklist items.
- Position nodes to create a readable graph layout (spread x from 50-900, y from 50-450).`;
}

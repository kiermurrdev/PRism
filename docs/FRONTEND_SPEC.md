# PRism Frontend Specification

This document is the authoritative specification for the PRism frontend. All coding agents must read this before making frontend changes.

## Colors

Use CSS variables only. Do not introduce raw color values.

| Token | Value | Usage |
|---|---|---|
| `--background` | `#090D18` | Page background |
| `--surface` | `#111827` | Card and section backgrounds |
| `--surface-elevated` | `#182235` | Elevated cards, overlays |
| `--border` | `#273449` | Borders, dividers |
| `--text-primary` | `#F8FAFC` | Primary text |
| `--text-muted` | `#94A3B8` | Secondary/muted text |
| `--accent-purple` | `#8B5CF6` | Primary accent |
| `--accent-cyan` | `#22D3EE` | Secondary accent |
| `--status-changed` | `#EAB308` | Changed status |
| `--status-direct` | `#F97316` | Directly affected |
| `--status-possible` | `#EF4444` | Possibly affected |
| `--status-unchanged` | `#64748B` | Unchanged/context |

Gradients are limited to the logo, primary CTA, and small accents.

## Typography

- Use Inter via `next/font/google`.
- No secondary fonts.

## Components

- Cards use `rounded-xl` (12px radius).
- Main content max-width: `max-w-[1280px]`.
- Do not use glassmorphism, excessive animation, or glowing borders.

## Page Flow

```
Landing page (/) → Simulated analysis (/analyze) → Demo report (/report/demo)
```

## Report Layout

### Desktop

- Full-width report header
- React Flow graph occupying eight columns (left)
- Summary and findings occupying four columns (right)
- Equal-width QA and affected-files cards below

### Mobile (order)

1. Report header
2. Summary
3. Impact graph
4. Findings
5. QA checklist
6. Affected files

## React Flow Contract

- Library: `@xyflow/react` only. No other graph library.
- Custom node type: `impactNode` (singular).
- Graph is read-only visualization.
- Enabled: pan, zoom, fit-view, node selection.
- Disabled: node dragging, creating connections, deleting elements.
- Use `Background` and `Controls`.
- No minimap.
- Edges: smooth-step (`type: "smoothstep"`).
- Clicking a node opens its details panel.
- Selected node receives a visible ring.
- Impact is represented with a label or icon in addition to color.
- Canvas height: 520px desktop, 420px mobile.
- Mock node positions come from shared mock data.

## Accessibility

- All interactive elements must be keyboard accessible.
- Use semantic HTML elements.
- Provide alt text for images and icons with meaning.
- Ensure color contrast meets WCAG AA.
- Graph must be navigable via keyboard.

## Shared Component Interfaces

- Report types are defined in `src/types/report.ts`.
- Mock data is in `src/data/mock-report.ts`.
- Use the shared `cn()` utility from `src/lib/utils.ts`.

## File Ownership

- `docs/FRONTEND_SPEC.md` — this specification (do not modify unless instructed)
- `src/types/report.ts` — shared types (do not modify unless instructed)
- `src/data/mock-report.ts` — mock data (do not modify unless instructed)
- `AGENTS.md` — agent instructions (do not modify unless instructed)

## Mock Data Usage

- Use the mock report for development and demonstration.
- The mock represents a realistic e-commerce PR adding coupon support.
- Do not call GitHub or Nemotron APIs; use mock data only.

## Out of Scope

- Real GitHub API integration
- Nemotron or AI API integration
- Authentication or user accounts
- Data persistence
- Backend services

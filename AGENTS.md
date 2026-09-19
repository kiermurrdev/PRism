# PRism — Agent Instructions

Before making any frontend changes:

1. **Read `docs/FRONTEND_SPEC.md`** — it is the authoritative specification for all frontend decisions.
2. Treat the specification as final; do not modify it or the shared contracts unless explicitly instructed.
3. Use `@xyflow/react` for all graph visualizations. Do not add another graph library.
4. Reuse shared report types (`src/types/report.ts`) and mock data (`src/data/mock-report.ts`).
5. Use CSS variables for colors; do not introduce raw color values without checking the spec.
6. Stay within the files assigned by your issue. Do not work on areas outside your scope.
7. Avoid APIs, authentication, persistence, and backend work unless your issue explicitly requires it.
8. Run `npm run lint` and `npm run build` before submitting your PR.

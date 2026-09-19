# PRism — Agent Instructions

Before making any changes:

1. **Read `docs/FRONTEND_SPEC.md`** — it is the authoritative specification for all frontend decisions.
2. **Read `docs/BACKEND_SPEC.md`** — it is the authoritative specification for all backend decisions.
3. Treat the specifications as final; do not modify them or the shared contracts unless explicitly instructed.
4. Use `@xyflow/react` for all graph visualizations. Do not add another graph library.
5. Reuse shared report types (`src/types/report.ts`) and mock data (`src/data/mock-report.ts`).
6. Use CSS variables for colors; do not introduce raw color values without checking the spec.
7. Stay within the files assigned by your issue. Do not work on areas outside your scope.
8. Keep secrets server-side. Never hard-code tokens or keys.
9. Run `npm run lint` and `npm run build` before submitting your PR.

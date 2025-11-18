# Contributing to HumanChat

## Code of Conduct
Be kind, inclusive, and respectful. See `context.md` for product principles and privacy commitments.

## Development Workflow
1. Fork or branch from `main` (we use trunk-based with short-lived feature branches).
2. Run `npm install` and `npm run test` before pushing.
3. Keep PRs focused (<500 LOC where possible).
4. Reference issues in commit/PR titles (e.g., `feat: add managed profile banner (#123)`).

## Coding Standards
- **TypeScript** everywhere; no `any` unless absolutely necessary (document why).
- **JSDoc** on exported functions/services describing purpose, params, and errors.
- **React** components as function components with explicit prop interfaces.
- Prefer composition over inheritance. Keep hooks small and pure.
- Follow existing ESLint/Prettier rules (format on save).

## Git Conventions
- Prefix commits with intent (`feat`, `fix`, `chore`, `test`, `docs`).
- Rebase onto latest `main` before opening PR.
- Squash merge via GitHub to keep history linear.

## Pull Request Checklist
- [ ] `npm run test` passes (unit + API + e2e if relevant).
- [ ] New tests added for changed behavior.
- [ ] Story/issue linked.
- [ ] Screenshots/GIFs for UI changes.
- [ ] Docs updated (README/COMPONENTS/API as needed).

## Testing Requirements
- Components: Jest + React Testing Library; mock network with MSW.
- API routes/services: Jest + Supertest hitting in-memory DB (see `tests/api`).
- End-to-end: Playwright `npm run test:e2e` targeting `apps/web` against local API.
- Load/perf: k6/Artillery scripts tracked under `tests/load` (future work).

## Tooling
- `npm run lint` (coming soon) to enforce style.
- GitHub Actions run tests + deploy; fix CI issues before request review.

Questions? Ping @maintainers in Slack or open a GitHub discussion.

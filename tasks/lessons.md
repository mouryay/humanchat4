# Lessons Learned

Patterns and rules captured from corrections to avoid repeating mistakes.

---

## Build & Deploy

### `.gitignore` glob patterns can break Docker builds
- **Pattern**: Broad globs like `env.*` match source files (e.g. `src/server/config/env.ts`), not just dotenv files.
- **Rule**: Always prefix root-only patterns with `/`. Test with `git check-ignore -v <path>` when in doubt.
- **Date**: 2026-02-22

### Use the correct tsconfig for server builds
- **Pattern**: `tsc -p tsconfig.json` used `moduleResolution: "Bundler"` which can't resolve `.js` → `.ts` imports. Server code needs `tsconfig.build.json` with `moduleResolution: "NodeNext"`.
- **Rule**: Before changing build config, verify which tsconfig the build script references and what module resolution it uses.
- **Date**: 2026-02-22

## React / Frontend

### All hooks must be declared before any early returns
- **Pattern**: `useState` declared after conditional `return` statements in `SessionView.tsx` caused React error #310 ("Rendered more hooks than during the previous render") when state changed and the component rendered past a previously-hit early return.
- **Rule**: Move every `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef` to the top of the component, before any `if (...) return` block. No exceptions.
- **Date**: 2026-02-22

### Dexie `db.hook()` can cause React render crashes
- **Pattern**: Using `db.instantInvites.hook('creating/updating/deleting')` for reactivity caused React error #310 because hook callbacks can return unexpected values that interfere with React's rendering.
- **Rule**: Use Dexie's `liveQuery` for reactive IndexedDB subscriptions instead of `db.hook()`.
- **Date**: 2026-02-22

### Backend API responses are wrapped in `{ success, data }`
- **Pattern**: Frontend code accessed `payload.requests` directly, but the backend wraps all responses in `{ success: true, data: { ... } }`. This caused silent failures and raw JSON errors shown to users.
- **Rule**: Always access `payload.data` first when parsing backend responses.
- **Date**: 2026-02-22

## Contributor Code Review

### Merged code may have TypeScript errors — always check before deploying
- **Pattern**: Pulled code from a contributor had 15 TypeScript errors (missing required props, wrong prop names, nonexistent interface fields, uninitialized refs, type mismatches with LiveKit). Build failed on Vercel.
- **Rule**: After every `git pull` with merged contributor code, run `npx tsc --noEmit` for both web and server tsconfigs before deploying.
- **Date**: 2026-02-22

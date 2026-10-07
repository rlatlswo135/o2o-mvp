# Server Vite+ test migration

## Scope
User authorized server test-toolchain migration. Preserve Nest build/start commands, server implementation, existing Oxlint/Prettier configuration, root Vite+ lint/fmt configuration, and unrelated working-tree changes.

## Dependents
- `server/package.json`: unit, watch, coverage, debug, E2E scripts and test dependencies.
- `server/vitest.config.ts`, `server/vitest.config.e2e.ts`: test selection and globals.
- `server/tsconfig.json`: test global declarations.
- Workspace `pnpm-lock.yaml`: shared dependency graph, including coverage provider peers.

## Coverage
- `server/src/app.controller.spec.ts`: Nest constructor injection and unit assertion.
- `server/test/app.e2e-spec.ts`: Nest bootstrap, HTTP endpoint and shutdown.
- Existing coverage script exercises V8 provider resolution.

## Risk: Medium
Installed Vite+ 1.0.0 bundles Vitest 5.0.1; server currently uses Vitest 4.1.11. Preserve test selection and global APIs; verify decorators/DI, E2E, coverage, typecheck and Nest build. Remove unused tsconfig-paths plugin (no server `paths` configuration). Match coverage provider exactly to bundled runner.

## Follow-up: lint/format consolidation
User explicitly approved removing standalone prettier, oxlint and oxlint-tsgolint. Replace server scripts with client-style check:fix/format:fix/lint:fix. Root fmt and lint gain server-only overrides preserving old .prettierrc/.oxlintrc options; delete obsolete configs. Existing client/common rules remain unchanged. lint-staged's server check:fix caller becomes valid. Verify tooling on changed config files, lint server without fixes, and re-run unit/E2E/coverage. Do not bulk-reformat application source or fix unrelated lint findings.

## Follow-up: consolidate test config; investigate tsconfig split
User authorized a single Vite test config and conditional tsconfig consolidation. Move unit/E2E include patterns into named inline `test.projects`; remove standalone E2E config. Keep existing script semantics by selecting unit for test/watch/coverage/debug and e2e for test:e2e. Bare `vp test` runs both.

`tsc --showConfig` confirms general tsconfig includes application, unit/E2E tests and Vite configs (rootDir '.'); build tsconfig includes only four application files (rootDir 'src'). Installed Nest CLI's `getDefaultTsconfigPath` selects tsconfig.build.json when present. Removing it would fall back to general config, emit tests/tool configs and move main output to dist/src/main.js, breaking existing start:prod. Making general config build-only would drop test/config typechecking. Retain small build override rather than introduce CLI/compiler workarounds; no tsconfig changes.

Verify unit/E2E selection independently, both projects together, unit coverage, general/build typechecking, and build-only file selection/output path via compiler CLI (Nest CLI itself still has pre-existing TypeScript 7.0 API incompatibility).

## Follow-up: pin server TypeScript 6
User chose Nest CLI compatibility over sharing the TypeScript 7 catalog entry. User refined requirement to `^6.0.0` (not exact patch pin). Change only server's direct TypeScript dependency to that major range (currently resolves 6.0.3); keep client TypeScript catalog, all Nest commands, tsconfig split and unrelated user edits (including new server paths alias) unchanged. Node runtime/.nvmrc is 24.21.0; retain @types/node catalog (^24) unless compiler validation shows incompatibility. Update workspace lockfile, verify package-local compiler versions, Nest build/start and Vite+ tests/typecheck/lint. No custom build runner or extra catalog abstraction.

## Pre-existing issue
`server/package.json` has a trailing comma; repair as part of the authorized manifest edits. `server/AGENTS.md` does not exist.

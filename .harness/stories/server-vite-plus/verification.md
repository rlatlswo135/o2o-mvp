# Verification

## Accepted changes
- Server test scripts use Vite+; explicit watch mode retained.
- Unit/E2E config files renamed to `vite.config.ts` / `vite.config.e2e.ts`, with `defineConfig` from `vite-plus`.
- Existing globals and test include patterns preserved. Global types use `vite-plus/test/globals`.
- Direct Vitest and unused vite-tsconfig-paths dependencies removed.
- V8 coverage provider pinned to bundled Vitest 5.0.1.
- Workspace root lockfile updated; unused, duplicate `server/pnpm-lock.yaml` removed. Workspace installation selects root lockfile.
- Invalid manifest trailing comma repaired.
- Nest build/start, application/test source, root config and existing server lint/format settings unchanged. Pre-existing client zod and server start:db edits preserved.

## Terminal verification
One contiguous successful run (exit 0):

```sh
pnpm --filter @server test && pnpm --filter @server test:e2e && pnpm --filter @server test:cov && pnpm --filter @server exec tsc --noEmit --incremental false && git diff --check
```

- Unit: Vitest 5.0.1, 1 file / 1 test passed.
- E2E: Vitest 5.0.1, 1 file / 1 test passed. Existing Nest constructor injection, HTTP endpoint and shutdown work without additional transform plugins.
- Coverage: V8 enabled, 1 file / 1 test passed. Report currently measures app.controller.ts: statements/lines/functions 100%, branches 50%. This is existing default coverage selection, not a claim of whole-server coverage.
- Typecheck: no diagnostics.
- Whitespace: no errors.
- `pnpm install --frozen-lockfile`: passed both before and after removal of unused package-local lockfile.
- Watch/debug flags checked against bundled CLI help; no interactive debugger session executed.
- Manifest/config assertions: passed (dependency removal, coverage version, script commands, renamed files and global types).

## Separate failed build run (exit 1)

```sh
pnpm --filter @server build
```

Nest CLI error:

> The installed TypeScript version (7.0.2) does not expose the programmatic compiler API that the Nest CLI requires. TypeScript 7.0 ships the "tsc" executable only; the compiler API is expected to return in 7.1. Please install TypeScript 6 (e.g. "npm i -D typescript@^6") until then.

Existing workspace catalog already specified TypeScript ^7.0.0; migration leaves compiler version and Nest build command unchanged. Server-specific TypeScript 6 pin requires a separate compatibility change, not applied here.

No new lint rules, broad formatting, commit or push.

## Authorized follow-up: lint/format consolidation
- Removed direct prettier, oxlint and oxlint-tsgolint dependencies, plus obsolete server/.prettierrc and server/.oxlintrc.json.
- Server scripts now match client: check:fix, format:fix, lint:fix. lint-staged's existing server check:fix reference is valid.
- Root fmt override for server/** preserves singleQuote: true and trailingComma: all.
- Root lint override for server/** preserves node environment, no-explicit-any: off and no-floating-promises: error. No additional server rules; existing shared/client rules unchanged.
- Ran check:fix only on changed server manifest/config files; no application/test source bulk formatting.

Successful final checks (exit 0):
- `pnpm --filter @server check:fix package.json vite.config.ts vite.config.e2e.ts`
- `pnpm exec vp fmt vite.config.ts --check`
- `pnpm --filter @server exec vp lint src/ test/ --format=agent` (no findings)
- One contiguous run: `pnpm --filter @server test && pnpm --filter @server test:e2e && pnpm --filter @server test:cov && pnpm --filter @server exec tsc --noEmit --incremental false` (unit/E2E/coverage each 1 test passed, no type errors).
- One contiguous run: `pnpm install --frozen-lockfile && pnpm exec vp check vite.config.ts && pnpm --filter @server exec vp check package.json vite.config.ts vite.config.e2e.ts && git diff --check`.

Config checks have warnings only for existing shared import/no-default-export rule (root: 1 warning, server configs: 2 warnings); no errors. Required default exports retained.

Separate initial check:fix attempt failed (exit 1) because including `../vite.config.ts` from server violates formatter path validation: `PATH must not contain ".."`. Root and package checks were rerun from their respective directories and passed.

Previously observed Nest/TypeScript 7.0 compiler API build incompatibility remains unchanged. No commit or push.

## Authorized follow-up: single Vite test config
- `server/vite.config.ts` contains shared globals/root and named inline unit/e2e projects. Vitest 5 inherits shared options.
- Removed `server/vite.config.e2e.ts`.
- Existing test/watch/coverage/debug scripts select unit; test:e2e selects e2e. Direct `vp test` runs both projects.
- No dependency or TypeScript configuration changes.

One contiguous successful run (exit 0):

```sh
pnpm --filter @server check:fix package.json vite.config.ts && pnpm --filter @server test && pnpm --filter @server test:e2e && pnpm --filter @server exec vp test && pnpm --filter @server test:cov && pnpm --filter @server exec tsc --noEmit --incremental false && pnpm --filter @server exec tsc -p tsconfig.build.json --noEmit --incremental false
```

Unit/E2E individually: each 1 file / 1 test passed. Both together: 2 files / 2 tests passed. Unit V8 coverage: 1 file / 1 test passed. General/build typechecks: no diagnostics. Config check: no errors, one default-export warning.

### TypeScript split investigation and decision
- `tsc --showConfig`: general config covers source, unit/E2E tests and Vite config; rootDir is server root.
- `tsc -p tsconfig.build.json --showConfig`: build config includes only app.controller.ts, app.module.ts, app.service.ts and main.ts; rootDir is src.
- Installed Nest CLI `lib/utils/get-default-tsconfig-path.js` chooses build config when present, otherwise general config.
- A real compiler-CLI emit into a disposable harness directory passed. Assertions confirmed exactly four application .js files, main.js directly under output directory, no src/ or test/ subdirectory. Disposable output removed.
- Retain both configs: using general config for builds would emit tests/tool files and move entry to dist/src/main.js; using build-only config generally would lose test/tool typechecking. Existing extends-based build override is smaller than adding custom compiler scripts.

E2E fixture bootstraps AppModule, initializes Nest, sends actual GET / using Supertest, asserts status/body, then closes application. It tests HTTP integration rather than browser UI. Test sources unchanged.

## Authorized follow-up: server TypeScript 6 compatibility
User requested server TypeScript `^6.0.0` rather than an exact patch pin. Manifest and root lockfile updated; currently resolves 6.0.3. Client remains catalog TypeScript 7.0.2. @types/node remains catalog (^24, resolved 24.19.0), matching .nvmrc/runtime Node 24.21.0. No change needed: library declaration checking also passed with skipLibCheck disabled. Existing user tsconfig paths addition preserved.

One contiguous successful run (exit 0):

```sh
pnpm install && pnpm --filter @server build && pnpm --filter @server exec tsc --noEmit --incremental false && pnpm --filter @server exec tsc --noEmit --incremental false --skipLibCheck false && pnpm --filter @server test && pnpm --filter @server test:e2e && pnpm --filter @server test:cov
```

Nest CLI build now passes: earlier TypeScript 7 compiler API failure resolved by server-local TypeScript 6 dependency. Unit/E2E/coverage each passed 1 file / 1 test. Both compiler typecheck variants passed with no diagnostics.

Additional successful checks (exit 0):
- Built JS application imported from server/dist/app.module.js, bootstrapped through NestFactory, listened on an ephemeral loopback port, fetched GET / and asserted HTTP 200 + Hello World!, then closed application. This verifies compiled runtime, not a watch/debug CLI lifecycle test.
- `pnpm install --frozen-lockfile && pnpm --filter @server exec vp lint src/ test/ --format=agent && git diff --check`.
- Compiler version checks: server 6.0.3, client 7.0.2.

No application source changes, commit or push.

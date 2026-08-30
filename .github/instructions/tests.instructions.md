---
applyTo: "**/*.test.ts,**/*.test.tsx,src/**/__tests__/**"
description: Test code
---

# Test instructions

## Framework
Vitest. No jest, no cypress, no playwright unless explicitly approved.

## Required pattern
- Engine tests: pure unit tests against the approved spec's reference cases.
- UI tests: behavior-first, query by role/label, not by CSS class.
- Reducer/state tests: assert on state shape, not internal implementation.

## Reference
- For new test vectors derive from
  `docs/engineering-specs/<relay>.md` reference cases.
- For UI regression use the same pattern as existing `*.test.tsx`.

## Before claiming PASS
Run `npx vitest run` and report the file count, the test count, and
the exact failure list. Never claim "all tests pass" without output.

## Anti-patterns (do NOT do these)
- ❌ `it.skip` / `describe.skip` to silence a failing test
- ❌ `it.todo` for a test that was once written
- ❌ Lowering threshold to make test pass
- ❌ `expect(value).toBeTruthy()` (use specific matcher)
- ❌ Testing internal implementation (test behavior, not internals)
- ❌ Querying by CSS class in UI tests (use role/label)
- ❌ Mocking without justification (mock at the boundary, not deeply)
- ❌ Importing from a different module in engine tests (test the unit)
- ❌ Sharing state between tests (each test must be independent)
- ❌ `Date.now()` / `Math.random()` in tests (inject or use fixed values)

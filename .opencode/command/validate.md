---
description: Quick parameter validation without full audit (fast feedback for development)
agent: general
---

Validate engineering parameters for $ARGUMENTS.

**Target module:** $1 (overcurrent, differential, distance)

**Validation checks:**
1. Read `src/types/$MODULE.ts` domain contracts
2. Validate against `src/engines/$MODULE.ts` constraints
3. Check parameter ranges, units, finite values
4. Verify `DomainEvaluation<T>` pattern usage

**Options:**
- `--engine-only`: Only validate engine logic, skip UI
- `--strict`: Include type checking with `tsc --noEmit`

**Output:** Validation errors with line numbers, or PASS

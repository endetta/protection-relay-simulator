---
description: Run Vitest test suite with coverage report
agent: general
---

Run the test suite for $ARGUMENTS.

**Command to execute:**
```bash
npx vitest run $1 $2
```

**Options:**
- No args: Run all tests
- Module name: Run tests for specific module (e.g., `overcurrent`, `differential`)
- `--watch`: Watch mode
- `--coverage`: Generate coverage report

**Report:**
- Test pass/fail count
- Coverage percentage
- Failed test details with line numbers

---
description: Build production bundle and verify output
agent: build
---

Build the production bundle for $ARGUMENTS.

**Command to execute:**
```bash
npm run build
```

**Options:**
- `--analyze`: Show bundle size analysis
- `--preview`: Start preview server after build

**Report:**
- Build status (PASS/FAIL)
- TypeScript errors (should be 0)
- Bundle size
- Output location: `dist/`

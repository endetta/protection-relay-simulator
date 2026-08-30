---
applyTo: "package.json,vite.config.ts,tsconfig*.json,tailwind.config.js,postcss.config.js"
description: Build, dependencies, and config files
---

# Config instructions

Do not change the framework, the bundler, the styling system, the
testing framework, or the TypeScript module/target without explicit
user approval. If a new dep is needed, justify it in the chat and
prefer a small, well-known package.

## Locked baseline
react, react-dom, react-router-dom, vite, typescript, vitest,
@vitejs/plugin-react, tailwindcss, postcss, autoprefixer.

## Anti-patterns (do NOT do these)
- ❌ Bumping major versions of locked deps without justification
- ❌ Adding a dep that exists in the locked set (e.g., a second chart lib)
- ❌ Adding `"type": "module"` differently than current
- ❌ Changing `tsconfig.json` `module` / `target` without approval
- ❌ Adding `webpack.config.js` (Vite only)
- ❌ Adding ESLint/Prettier without user approval
- ❌ Removing `strict: true` from tsconfig
- ❌ Downgrading Vitest to v3 (project uses v4)
- ❌ Adding `node` polyfills for browser-only code
- ❌ Adding `vite-plugin-pwa` or similar without user approval

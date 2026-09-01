// Ambient declarations for Vite/Rollup non-JS import suffixes.
// Consumed by TypeScript (tsc) during the type-check gate; Vite/Vitest
// handles these natively at runtime without this file.

declare module '*?raw' {
  const content: string;
  export default content;
}

// Narrow ambient shim for the CSS token-existence test.
// The project intentionally has no @types/node; tsc (target: ES2020,
// lib: DOM only) needs these to compile readFileSync/resolve usage.
// Vitest's Node runtime already provides the real implementations.

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:path' {
  export function resolve(...segments: string[]): string;
  export function dirname(p: string): string;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: string): string;
}

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guard against the regression that produced the fatal SLD color bug:
// someone used var(--sim-surface), var(--sim-surface-subtle), var(--sim-muted)
// — none of which are defined in src/index.css — so the browser fell back to
// hardcoded light-theme hex (#fff, #f8fafc) on the dark workspace.
//
// This test treats the project token contract as a compile-time gate: every
// --sim-* custom property referenced by the SLD CSS MUST be defined in
// index.css, and there MUST NOT be a light-theme hex fallback anywhere.
//
// tsc (target: ES2020, lib: DOM only) has no @types/node — see src/env.d.ts
// for the narrow ambient shim. Vitest's Node runtime already provides the
// real implementations.

const HERE = dirname(fileURLToPath(import.meta.url));
const SLD_CSS = readFileSync(resolve(HERE, './underfrequencySld.css'), 'utf-8');
const INDEX_CSS = readFileSync(resolve(HERE, '../../index.css'), 'utf-8');

function extractDefinedTokens(css: string): Set<string> {
  const tokens = new Set<string>();
  // Matches "  --token-name: value;" — the project token blocks use 2-space indent.
  const re = /^\s*(--sim-[a-z0-9-]+):\s*\S/mg;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    tokens.add(m[1]);
  }
  return tokens;
}

function extractReferencedTokens(css: string): Set<string> {
  const tokens = new Set<string>();
  // Matches "var(--sim-...)" inside any declaration value.
  const re = /var\((--sim-[a-z0-9-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    tokens.add(m[1]);
  }
  return tokens;
}

describe('UFR SLD CSS token contract', () => {
  const defined = extractDefinedTokens(INDEX_CSS);
  const referenced = extractReferencedTokens(SLD_CSS);

  it('defines the project token set in index.css', () => {
    // The contract must at least cover the tokens the SLD relies on for panels.
    expect(defined.has('--sim-panel')).toBe(true);
    expect(defined.has('--sim-panel-raised')).toBe(true);
    expect(defined.has('--sim-border')).toBe(true);
    expect(defined.has('--sim-text')).toBe(true);
    expect(defined.has('--sim-accent')).toBe(true);
    expect(defined.has('--sim-green')).toBe(true);
    expect(defined.has('--sim-amber')).toBe(true);
    expect(defined.has('--sim-red')).toBe(true);
  });

  it('every --sim-* token referenced by the SLD CSS is defined in index.css', () => {
    for (const token of referenced) {
      expect(defined.has(token), `UFR SLD references undefined token ${token} in underfrequencySld.css`).toBe(true);
    }
  });

  it('does not reference a bare light-theme hex fallback in any var()', () => {
    // The exact bug: var(--sim-surface, #fff). No light-theme fallback allowed.
    const lightHexFallback = /var\(--sim-[a-z0-9-]+,\s*#(?:fff|fff\b|[0-9a-f]{3})\b\)/i;
    const offenders = [...SLD_CSS.matchAll(new RegExp(lightHexFallback.source, 'gi'))].map((m) => m[0]);
    expect(offenders, `light-theme fallbacks found: ${offenders.join(', ')}`).toEqual([]);
  });

  it('uses the token system and not raw light-theme surface hex in panel/wrapper', () => {
    // Container background must be a token (--sim-panel), never #fff / #F5F7FA.
    const container = SLD_CSS.match(/\.underfrequency-sld\s*{[^}]*background:[^;]*;/);
    expect(container).not.toBeNull();
    expect(container![0]).toMatch(/background:\s*var\(--sim-[a-z0-9-]+\)/);
  });
});
